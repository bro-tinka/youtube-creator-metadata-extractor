import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { normalizeKey } from "./text.js";

function cellText(cell) {
  if (typeof cell.value === "string") return cell.value;
  if (cell.value && typeof cell.value === "object") return cell.value.text ?? cell.value.hyperlink ?? cell.text;
  return cell.text ?? "";
}

export class WorkbookSink {
  constructor(filePath, logger) {
    this.filePath = filePath;
    this.logger = logger;
    this.workbook = new ExcelJS.Workbook();
    this.sheet = null;
    this.columns = null;
  }

  async open() {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await this.workbook.xlsx.readFile(this.filePath);
      this.logger.info("Loaded workbook", { file: this.filePath });
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      this.logger.warn("Workbook not found; creating a new one", { file: this.filePath });
    }

    this.sheet = this.workbook.getWorksheet("Free Fire Creators") ?? this.workbook.worksheets[0] ?? this.workbook.addWorksheet("Free Fire Creators");
    this.ensureColumns();
    return this;
  }

  ensureColumns() {
    const expected = ["Name", "Email", "YouTubeChannel", "Instagram"];
    const header = this.sheet.getRow(1);
    const found = new Map();
    for (let column = 1; column <= Math.max(header.cellCount, expected.length); column++) {
      const label = cellText(header.getCell(column)).trim();
      if (label) found.set(label.toLowerCase(), column);
    }
    for (const label of expected) {
      if (!found.has(label.toLowerCase())) {
        const column = this.sheet.columnCount + 1;
        header.getCell(column).value = label;
        found.set(label.toLowerCase(), column);
      }
    }
    this.columns = Object.fromEntries(expected.map((label) => [label, found.get(label.toLowerCase())]));
  }

  findRow(youtubeChannel) {
    const target = normalizeKey(youtubeChannel);
    for (let number = 2; number <= this.sheet.rowCount; number++) {
      const row = this.sheet.getRow(number);
      if (normalizeKey(cellText(row.getCell(this.columns.YouTubeChannel))) === target) return row;
    }
    return null;
  }

  setIfPresent(row, column, value) {
    if (value) row.getCell(column).value = value;
  }

  async upsertAndSave(record) {
    const row = this.findRow(record.youtubeChannel) ?? this.sheet.addRow([]);
    this.setIfPresent(row, this.columns.Name, record.name);
    this.setIfPresent(row, this.columns.Email, record.email);
    this.setIfPresent(row, this.columns.YouTubeChannel, record.youtubeChannel);
    this.setIfPresent(row, this.columns.Instagram, record.instagram);
    await this.saveNow();
    this.logger.info("Saved creator immediately", { name: record.name, email: record.email || "", channel: record.youtubeChannel });
  }

  async saveNow() {
    await this.workbook.xlsx.writeFile(this.filePath);
  }
}
