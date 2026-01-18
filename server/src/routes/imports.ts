import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import XLSX from 'xlsx';
import pdfParse from 'pdf-parse';
import Tesseract from 'tesseract.js';
import prisma from '../database';
import { authenticateToken, AuthRequest, requireRole } from '../middleware/auth';
import { MaritalStatus, MemberStatus } from '@prisma/client';

const router = Router();

// Types
interface ImportedMember {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  address?: string;
  birthday?: string;
  maritalStatus?: 'single' | 'married' | 'undisclosed';
  status?: 'pending_approval' | 'active' | 'inactive';
  cellGroupName?: string;
  broughtBy?: string;
  notes?: string;
}

interface ParseError {
  rowIndex: number;
  issues: string[];
}

interface ParseResult {
  rows: ImportedMember[];
  errors: ParseError[];
}

// Duplicate detection types
interface DuplicateInfo {
  isMatch: boolean;
  matchedMemberId?: number;
  matchType?: 'email' | 'phone' | 'name_birthday';
  matchedMemberName?: string;
}

interface ImportedMemberWithDuplicate extends ImportedMember {
  duplicateInfo?: DuplicateInfo;
}

// Configure multer for file uploads
const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/pdf',
      'image/jpeg',
      'image/png'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: xlsx, xls, csv, pdf, jpg, png'));
    }
  }
});

// Column name mapping (case-insensitive)
const columnMappings: Record<string, keyof ImportedMember> = {
  'firstname': 'firstName',
  'first_name': 'firstName',
  'first name': 'firstName',
  'lastname': 'lastName',
  'last_name': 'lastName',
  'last name': 'lastName',
  'email': 'email',
  'phone': 'phone',
  'telephone': 'phone',
  'mobile': 'phone',
  'address': 'address',
  'birthday': 'birthday',
  'birth_date': 'birthday',
  'birthdate': 'birthday',
  'date of birth': 'birthday',
  'dob': 'birthday',
  'maritalstatus': 'maritalStatus',
  'marital_status': 'maritalStatus',
  'marital status': 'maritalStatus',
  'status': 'status',
  'cellgroupname': 'cellGroupName',
  'cell_group_name': 'cellGroupName',
  'cell group name': 'cellGroupName',
  'cell group': 'cellGroupName',
  'cellgroup': 'cellGroupName',
  'broughtby': 'broughtBy',
  'brought_by': 'broughtBy',
  'brought by': 'broughtBy',
  'referred by': 'broughtBy',
  'notes': 'notes',
  'note': 'notes',
  'comment': 'notes',
  'comments': 'notes'
};

function normalizeColumnName(name: string): keyof ImportedMember | null {
  const normalized = name.toLowerCase().trim();
  return columnMappings[normalized] || null;
}

// ---- FIX HELPERS (prevents assigning undefined to required string fields) ----
function asTrimmedString(value: any): string {
  return String(value ?? '').trim();
}

function setOptionalString(obj: ImportedMember, key: keyof ImportedMember, value: any) {
  const v = asTrimmedString(value);
  if (v !== '') {
    (obj as any)[key] = v;
  }
}

function parseDate(value: any): string | undefined {
  if (!value) return undefined;

  // Handle Excel serial dates
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
    }
  }

  // Handle string dates
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Try various date formats
    const datePatterns = [
      /^(\d{4})-(\d{2})-(\d{2})$/, // YYYY-MM-DD
      /^(\d{2})\/(\d{2})\/(\d{4})$/, // MM/DD/YYYY
      /^(\d{2})-(\d{2})-(\d{4})$/, // MM-DD-YYYY
      /^(\d{2})\.(\d{2})\.(\d{4})$/, // DD.MM.YYYY
    ];

    for (const pattern of datePatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        if (pattern === datePatterns[0]) {
          return trimmed;
        }
        // Convert to ISO format
        const date = new Date(trimmed);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
      }
    }

    // Try native Date parsing
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  return undefined;
}

function normalizeMaritalStatus(value: any): 'single' | 'married' | 'undisclosed' {
  if (!value) return 'undisclosed';
  const normalized = String(value).toLowerCase().trim();
  if (normalized === 'single') return 'single';
  if (normalized === 'married') return 'married';
  return 'undisclosed';
}

function normalizeMemberStatus(value: any): 'pending_approval' | 'active' | 'inactive' {
  if (!value) return 'pending_approval';
  const normalized = String(value).toLowerCase().trim().replace(/\s+/g, '_');
  if (normalized === 'active') return 'active';
  if (normalized === 'inactive') return 'inactive';
  return 'pending_approval';
}

// Parse Excel/CSV files
function parseExcelOrCsv(filePath: string): ParseResult {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawData: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  const rows: ImportedMember[] = [];
  const errors: ParseError[] = [];

  // Get column mapping from first row
  if (rawData.length === 0) {
    return { rows: [], errors: [] };
  }

  const headers = Object.keys(rawData[0]);
  const fieldMap: Record<string, keyof ImportedMember> = {};
  for (const header of headers) {
    const mapped = normalizeColumnName(header);
    if (mapped) {
      fieldMap[header] = mapped;
    }
  }

  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    const member: ImportedMember = { firstName: '', lastName: '' };
    const rowIssues: string[] = [];

    for (const [originalCol, mappedField] of Object.entries(fieldMap)) {
      const value = row[originalCol];

      switch (mappedField) {
        case 'firstName': {
          member.firstName = asTrimmedString(value);
          break;
        }
        case 'lastName': {
          member.lastName = asTrimmedString(value);
          break;
        }
        case 'email':
        case 'phone':
        case 'address':
        case 'cellGroupName':
        case 'broughtBy':
        case 'notes': {
          setOptionalString(member, mappedField, value);
          break;
        }
        case 'birthday':
          member.birthday = parseDate(value);
          break;
        case 'maritalStatus':
          member.maritalStatus = normalizeMaritalStatus(value);
          break;
        case 'status':
          member.status = normalizeMemberStatus(value);
          break;
      }
    }

    // Validate required fields
    if (!member.firstName) rowIssues.push('Missing first name');
    if (!member.lastName) rowIssues.push('Missing last name');

    if (rowIssues.length > 0) {
      errors.push({ rowIndex: i, issues: rowIssues });
    }

    rows.push(member);
  }

  return { rows, errors };
}

// Parse PDF files
async function parsePdf(filePath: string): Promise<ParseResult> {
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  const text = data.text;

  return parseTextToMembers(text);
}

// Parse image files with OCR
async function parseImage(filePath: string): Promise<ParseResult> {
  const result = await Tesseract.recognize(filePath, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
      }
    }
  });

  return parseTextToMembers(result.data.text);
}

// Parse text content into member rows (best effort for PDF/OCR)
function parseTextToMembers(text: string): ParseResult {
  const rows: ImportedMember[] = [];
  const errors: ParseError[] = [];

  // Split into lines and filter empty
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Try to detect if it's a table-like structure
  // Look for common separators: tab, comma, multiple spaces, pipe
  const separatorPatterns = [/\t/, /,(?=(?:[^"]*"[^"]*")*[^"]*$)/, /\s{2,}/, /\|/];

  let bestSeparator: RegExp | null = null;
  let headerRow: string[] | null = null;
  let startIndex = 0;

  // Try to find a header row
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].toLowerCase();
    if (line.includes('first') || line.includes('name') || line.includes('email')) {
      for (const sep of separatorPatterns) {
        const parts = lines[i].split(sep).map(p => p.trim()).filter(p => p);
        if (parts.length >= 2) {
          bestSeparator = sep;
          headerRow = parts;
          startIndex = i + 1;
          break;
        }
      }
      if (headerRow) break;
    }
  }

  // If we found a structured format
  if (headerRow && bestSeparator) {
    const fieldMap: Record<number, keyof ImportedMember> = {};
    headerRow.forEach((col, idx) => {
      const mapped = normalizeColumnName(col);
      if (mapped) fieldMap[idx] = mapped;
    });

    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(bestSeparator).map(p => p.trim());
      const member: ImportedMember = { firstName: '', lastName: '' };
      const rowIssues: string[] = [];

      for (const [idxStr, field] of Object.entries(fieldMap)) {
        const idx = parseInt(idxStr);
        const value = parts[idx] || '';

        switch (field) {
          case 'firstName':
            member.firstName = asTrimmedString(value);
            break;

          case 'lastName':
            member.lastName = asTrimmedString(value);
            break;

          case 'email':
          case 'phone':
          case 'address':
          case 'cellGroupName':
          case 'broughtBy':
          case 'notes':
            setOptionalString(member, field, value);
            break;

          case 'birthday':
            member.birthday = parseDate(value);
            break;

          case 'maritalStatus':
            member.maritalStatus = normalizeMaritalStatus(value);
            break;

          case 'status':
            member.status = normalizeMemberStatus(value);
            break;
        }
      }

      if (!member.firstName) rowIssues.push('Missing first name');
      if (!member.lastName) rowIssues.push('Missing last name');

      if (rowIssues.length > 0) {
        errors.push({ rowIndex: i - startIndex, issues: rowIssues });
      }

      rows.push(member);
    }
  } else {
    // Fallback: try to parse names from each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Try to extract name (First Last pattern)
      const nameMatch = line.match(/^([A-Z][a-z]+)\s+([A-Z][a-z]+)/);
      if (nameMatch) {
        const member: ImportedMember = {
          firstName: nameMatch[1],
          lastName: nameMatch[2]
        };

        // Try to extract email
        const emailMatch = line.match(/[\w.-]+@[\w.-]+\.\w+/);
        if (emailMatch) member.email = emailMatch[0];

        // Try to extract phone
        const phoneMatch = line.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
        if (phoneMatch) member.phone = phoneMatch[0];

        rows.push(member);
      }
    }

    if (rows.length === 0) {
      errors.push({ rowIndex: 0, issues: ['Could not parse any member records from text'] });
    }
  }

  return { rows, errors };
}

// Check for duplicate members in database
async function checkDuplicates(rows: ImportedMember[]): Promise<ImportedMemberWithDuplicate[]> {
  const result: ImportedMemberWithDuplicate[] = [];

  for (const row of rows) {
    let duplicateInfo: DuplicateInfo = { isMatch: false };

    // Check by email first
    if (row.email) {
      const match = await prisma.member.findFirst({
        where: { email: row.email },
        select: { id: true, firstName: true, lastName: true }
      });
      if (match) {
        duplicateInfo = {
          isMatch: true,
          matchedMemberId: match.id,
          matchType: 'email',
          matchedMemberName: `${match.firstName} ${match.lastName}`
        };
      }
    }

    // Check by phone if no email match
    if (!duplicateInfo.isMatch && row.phone) {
      const match = await prisma.member.findFirst({
        where: { phone: row.phone },
        select: { id: true, firstName: true, lastName: true }
      });
      if (match) {
        duplicateInfo = {
          isMatch: true,
          matchedMemberId: match.id,
          matchType: 'phone',
          matchedMemberName: `${match.firstName} ${match.lastName}`
        };
      }
    }

    // Check by name + birthday if no other match
    if (!duplicateInfo.isMatch && row.birthday) {
      const match = await prisma.member.findFirst({
        where: {
          firstName: row.firstName,
          lastName: row.lastName,
          birthday: new Date(row.birthday)
        },
        select: { id: true, firstName: true, lastName: true }
      });
      if (match) {
        duplicateInfo = {
          isMatch: true,
          matchedMemberId: match.id,
          matchType: 'name_birthday',
          matchedMemberName: `${match.firstName} ${match.lastName}`
        };
      }
    }

    result.push({ ...row, duplicateInfo });
  }

  return result;
}

// Template download endpoint
router.get(
  '/template',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const templateData = [
      {
        'First Name': 'John',
        'Last Name': 'Doe',
        'Email': 'john.doe@example.com',
        'Phone': '555-123-4567',
        'Address': '123 Main Street, City',
        'Birthday': '1990-05-15',
        'Marital Status': 'married',
        'Status': 'active',
        'Cell Group': 'Youth Group',
        'Brought By': 'Jane Smith',
        'Notes': 'Sample member entry'
      },
      {
        'First Name': 'Jane',
        'Last Name': 'Smith',
        'Email': 'jane.smith@example.com',
        'Phone': '555-987-6543',
        'Address': '456 Oak Avenue, Town',
        'Birthday': '1985-12-20',
        'Marital Status': 'single',
        'Status': 'pending_approval',
        'Cell Group': "Women's Group",
        'Brought By': '',
        'Notes': ''
      }
    ];

    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateData);

    // Set column widths for better readability
    worksheet['!cols'] = [
      { wch: 15 }, // First Name
      { wch: 15 }, // Last Name
      { wch: 25 }, // Email
      { wch: 15 }, // Phone
      { wch: 30 }, // Address
      { wch: 12 }, // Birthday
      { wch: 15 }, // Marital Status
      { wch: 18 }, // Status
      { wch: 20 }, // Cell Group
      { wch: 15 }, // Brought By
      { wch: 30 }, // Notes
    ];

    XLSX.utils.book_append_sheet(workbook, worksheet, 'Members');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="member-import-template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  }
);

// Upload endpoint
router.post(
  '/upload',
  authenticateToken,
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileType = path.extname(req.file.originalname).toLowerCase().slice(1);

    const importRecord = await prisma.import.create({
      data: {
        filename: req.file.originalname,
        filePath: req.file.path,
        fileType,
        status: 'pending',
        createdBy: req.user!.userId
      }
    });

    res.json({
      importId: importRecord.id,
      filename: importRecord.filename
    });
  }
);

// Parse endpoint - supports ?checkDuplicates=true query param
router.post(
  '/:importId/parse',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const { importId } = req.params;
    const checkDuplicatesFlag = req.query.checkDuplicates === 'true';
    const id = parseInt(importId);

    const importRecord = await prisma.import.findUnique({ where: { id } });
    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    if (!fs.existsSync(importRecord.filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    let result: ParseResult;

    try {
      switch (importRecord.fileType) {
        case 'xlsx':
        case 'xls':
        case 'csv':
          result = parseExcelOrCsv(importRecord.filePath);
          break;
        case 'pdf':
          result = await parsePdf(importRecord.filePath);
          break;
        case 'jpg':
        case 'jpeg':
        case 'png':
          result = await parseImage(importRecord.filePath);
          break;
        default:
          return res.status(400).json({ error: 'Unsupported file type' });
      }

      // Check duplicates if requested
      let finalRows: ImportedMember[] | ImportedMemberWithDuplicate[] = result.rows;
      if (checkDuplicatesFlag) {
        finalRows = await checkDuplicates(result.rows);
      }

      // Update import record with parsed data
      await prisma.import.update({
        where: { id },
        data: {
          status: 'parsed',
          rowCount: result.rows.length,
          parsedData: finalRows as any,
          errors: result.errors as any
        }
      });

      res.json({
        importId: id,
        filename: importRecord.filename,
        rows: finalRows,
        errors: result.errors
      });
    } catch (error) {
      console.error('[Import] Parse error:', error);
      await prisma.import.update({
        where: { id },
        data: { status: 'failed', errors: { message: String(error) } }
      });
      return res.status(500).json({ error: 'Failed to parse file' });
    }
  }
);

// Commit endpoint (super_admin only) - accepts optional rows and skippedIndices in body
router.post(
  '/:importId/commit',
  authenticateToken,
  requireRole('super_admin'),
  async (req: AuthRequest, res: Response) => {
    const { importId } = req.params;
    const { rows: providedRows, skippedIndices } = req.body as {
      rows?: ImportedMember[];
      skippedIndices?: number[];
    };
    const id = parseInt(importId);

    const importRecord = await prisma.import.findUnique({ where: { id } });
    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    if (importRecord.status !== 'parsed') {
      return res.status(400).json({ error: 'Import must be parsed before committing' });
    }

    // Use provided rows if available, otherwise use stored parsed data
    // Strip duplicateInfo from rows if present
    const rawRows = providedRows || (importRecord.parsedData as unknown as ImportedMemberWithDuplicate[]);
    const rows: ImportedMember[] = rawRows.map(({ duplicateInfo, ...rest }: any) => rest);

    if (!rows || rows.length === 0) {
      return res.status(400).json({ error: 'No data to import' });
    }

    // Create set of skipped indices for fast lookup
    const skippedSet = new Set(skippedIndices || []);

    // Fetch all cell groups for name matching
    const cellGroups = await prisma.cellGroup.findMany();
    const cellGroupMap = new Map(cellGroups.map(cg => [cg.name.toLowerCase(), cg.id]));

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const commitErrors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      // Skip rows marked for skipping
      if (skippedSet.has(i)) {
        skipped++;
        continue;
      }

      const row = rows[i];

      // Validate required fields
      if (!row.firstName || !row.lastName) {
        skipped++;
        commitErrors.push(`Row ${i + 1}: Missing first or last name`);
        continue;
      }

      try {
        // Find existing member by priority: email > phone > name+birthday
        let existingMember: { id: number } | null = null;

        if (row.email) {
          existingMember = await prisma.member.findFirst({
            where: { email: row.email },
            select: { id: true }
          });
        }

        if (!existingMember && row.phone) {
          existingMember = await prisma.member.findFirst({
            where: { phone: row.phone },
            select: { id: true }
          });
        }

        if (!existingMember && row.birthday) {
          existingMember = await prisma.member.findFirst({
            where: {
              firstName: row.firstName,
              lastName: row.lastName,
              birthday: new Date(row.birthday)
            },
            select: { id: true }
          });
        }

        // Resolve cell group ID from name
        let cellGroupId: number | null = null;
        if (row.cellGroupName) {
          cellGroupId = cellGroupMap.get(row.cellGroupName.toLowerCase()) || null;
        }

        const memberData = {
          firstName: row.firstName,
          lastName: row.lastName,
          email: row.email || null,
          phone: row.phone || null,
          address: row.address || null,
          birthday: row.birthday ? new Date(row.birthday) : null,
          maritalStatus: (row.maritalStatus || 'undisclosed') as MaritalStatus,
          status: (row.status || 'pending_approval') as MemberStatus,
          cellGroupId,
          broughtBy: row.broughtBy || null,
          notes: row.notes || null
        };

        if (existingMember) {
          await prisma.member.update({
            where: { id: existingMember.id },
            data: memberData
          });
          updated++;
        } else {
          await prisma.member.create({
            data: memberData
          });
          created++;
        }
      } catch (error) {
        skipped++;
        commitErrors.push(`Row ${i + 1}: ${String(error)}`);
      }
    }

    // Update import status
    await prisma.import.update({
      where: { id },
      data: { status: 'committed' }
    });

    // Clean up file
    try {
      fs.unlinkSync(importRecord.filePath);
    } catch {
      // Ignore file cleanup errors
    }

    res.json({
      created,
      updated,
      skipped,
      errors: commitErrors
    });
  }
);

// Get import status
router.get(
  '/:importId',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const { importId } = req.params;
    const id = parseInt(importId);

    const importRecord = await prisma.import.findUnique({
      where: { id },
      select: {
        id: true,
        filename: true,
        fileType: true,
        status: true,
        rowCount: true,
        errors: true,
        createdAt: true
      }
    });

    if (!importRecord) {
      return res.status(404).json({ error: 'Import not found' });
    }

    res.json(importRecord);
  }
);

// List imports
router.get(
  '/',
  authenticateToken,
  async (req: AuthRequest, res: Response) => {
    const imports = await prisma.import.findMany({
      where: { createdBy: req.user!.userId },
      select: {
        id: true,
        filename: true,
        fileType: true,
        status: true,
        rowCount: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    res.json(imports);
  }
);

export default router;