import type {
  AdminConversation,
  AttachmentKind,
  Message,
  MessageAttachment,
} from "@/lib/contracts";

type ArchiveConversationInput = {
  conversation: AdminConversation;
  messages: Message[];
};

type ArchivedAttachment = {
  attachment: MessageAttachment;
  relativePath: string | null;
  data: Buffer | null;
  error: string | null;
};

type ZipEntry = {
  name: string;
  data: Buffer;
};

export type LocalConversationArchiveZip = {
  fileName: string;
  data: Buffer;
  mediaCount: number;
  failedMediaCount: number;
};

const MEDIA_DIR_BY_KIND: Record<AttachmentKind, string> = {
  image: "img",
  audio: "voice",
  video: "video",
};

const EXTENSION_BY_MIME_TYPE: Record<string, string> = {
  "audio/mp4": ".m4a",
  "audio/mpeg": ".mp3",
  "audio/ogg": ".ogg",
  "audio/webm": ".webm",
  "image/gif": ".gif",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/quicktime": ".mov",
  "video/webm": ".webm",
};

const CRC32_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function safeSegment(value: string): string {
  return (
    value
      .trim()
      .replace(/[\\/:*?"<>|#%{}[\]^~`]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "untitled"
  );
}

function timestampForPath(value: string): string {
  return value.replace(/[:.]/g, "-").replace("T", "_").replace("Z", "");
}

function extensionForAttachment(attachment: MessageAttachment): string {
  const mimeExtension = EXTENSION_BY_MIME_TYPE[attachment.mimeType];
  if (mimeExtension) return mimeExtension;

  const fileName = attachment.storagePath.split("/").pop() ?? "";
  const storageExtension = fileName.includes(".")
    ? `.${fileName.split(".").pop() ?? ""}`
    : "";
  if (/^\.[a-z0-9]{1,12}$/i.test(storageExtension)) {
    return storageExtension.toLowerCase();
  }

  return "";
}

function escapeMarkdown(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
}

function formatSender(sender: Message["sender"]): string {
  if (sender === "user") return "用户";
  if (sender === "admin") return "管理员";
  return "助手";
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { date: number; time: number } {
  const year = Math.max(1980, date.getFullYear());
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
  };
}

function createZip(entries: ZipEntry[]): Buffer {
  const now = dosDateTime(new Date());
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const checksum = crc32(entry.data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(now.time, 10);
    localHeader.writeUInt16LE(now.date, 12);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, name, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(now.time, 12);
    centralHeader.writeUInt16LE(now.date, 14);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(entry.data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + entry.data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

async function downloadAttachment(
  messageIndex: number,
  attachmentIndex: number,
  attachment: MessageAttachment
): Promise<ArchivedAttachment> {
  const mediaDirectoryName = MEDIA_DIR_BY_KIND[attachment.kind];
  const extension = extensionForAttachment(attachment);
  const fileName =
    [
      String(messageIndex + 1).padStart(3, "0"),
      String(attachmentIndex + 1).padStart(2, "0"),
      attachment.id,
    ].join("-") + extension;
  const relativePath = `${mediaDirectoryName}/${fileName}`;

  try {
    const response = await fetch(attachment.url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return {
      attachment,
      relativePath,
      data: Buffer.from(await response.arrayBuffer()),
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "download failed";
    return { attachment, relativePath: null, data: null, error: message };
  }
}

function makeMarkdown(input: {
  conversation: AdminConversation;
  messages: Message[];
  archivedAttachments: Map<string, ArchivedAttachment>;
  archivedAt: string;
}): string {
  const { conversation, messages, archivedAttachments, archivedAt } = input;
  const lines: string[] = [
    `# ${conversation.title}`,
    "",
    "## 会话信息",
    "",
    `- 会话 ID: \`${conversation.id}\``,
    `- 用户 ID: \`${conversation.userId}\``,
    `- 用户名: ${conversation.user?.username ?? "未知用户"}`,
    `- 状态: ${conversation.status}`,
    `- 创建时间: ${conversation.createdAt}`,
    `- 更新时间: ${conversation.updatedAt}`,
    `- 本地归档时间: ${archivedAt}`,
    "",
    "## 消息记录",
    "",
  ];

  messages.forEach((message, messageIndex) => {
    lines.push(
      `### ${messageIndex + 1}. ${formatSender(message.sender)} · ${message.createdAt}`,
      ""
    );
    lines.push(message.text.trim() || "_无文字内容_", "");

    if (message.attachments.length > 0) {
      lines.push("| 类型 | 文件 | MIME | 大小 |", "| --- | --- | --- | --- |");
      message.attachments.forEach((attachment) => {
        const archived = archivedAttachments.get(attachment.id);
        const fileCell = archived?.relativePath
          ? `[${escapeMarkdown(archived.relativePath)}](${encodeURI(
              archived.relativePath
            )})`
          : `下载失败: ${escapeMarkdown(archived?.error ?? "未知错误")}`;
        lines.push(
          `| ${attachment.kind} | ${fileCell} | ${escapeMarkdown(
            attachment.mimeType
          )} | ${attachment.size} |`
        );
      });
      lines.push("");
    }
  });

  return lines.join("\n");
}

export async function createConversationArchiveZip({
  conversation,
  messages,
}: ArchiveConversationInput): Promise<LocalConversationArchiveZip> {
  const archivedAt = new Date().toISOString();
  const baseName = [
    timestampForPath(archivedAt),
    safeSegment(conversation.user?.username ?? conversation.userId),
    safeSegment(conversation.title),
    conversation.id.slice(0, 8),
  ].join("_");

  const archivedAttachments = new Map<string, ArchivedAttachment>();
  const downloads = messages.flatMap((message, messageIndex) =>
    message.attachments.map((attachment, attachmentIndex) =>
      downloadAttachment(messageIndex, attachmentIndex, attachment)
    )
  );
  const downloadResults = await Promise.all(downloads);
  downloadResults.forEach((result) => {
    archivedAttachments.set(result.attachment.id, result);
  });

  const entries: ZipEntry[] = [
    { name: "img/", data: Buffer.alloc(0) },
    { name: "voice/", data: Buffer.alloc(0) },
    { name: "video/", data: Buffer.alloc(0) },
    {
      name: "conversation.md",
      data: Buffer.from(
        makeMarkdown({
          conversation,
          messages,
          archivedAttachments,
          archivedAt,
        }),
        "utf8"
      ),
    },
  ];

  for (const result of downloadResults) {
    if (result.relativePath && result.data) {
      entries.push({ name: result.relativePath, data: result.data });
    }
  }

  return {
    fileName: `${baseName}.zip`,
    data: createZip(entries),
    mediaCount: downloadResults.filter((result) => result.data).length,
    failedMediaCount: downloadResults.filter((result) => result.error).length,
  };
}
