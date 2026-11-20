import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import https from 'https';
import { PlagiarismRepository } from '../repositories/plagiarism.repository';
import { AppError } from '../utils/AppError';

export interface StrikeCheckStatusResponse {
  documentId: string;
  isReady: boolean;
  status: string;
  factor1: number;
  factor2: number;
  similarityPercentage: number;
  isEligible: boolean;
  title?: string;
  author?: string;
}

export class StrikePlagiarismService {
  private repo = new PlagiarismRepository();
  private apiKey = (process.env.STRIKE_PLAGIARISM_API_KEY || '').trim();
  private apiUrl = (process.env.STRIKE_PLAGIARISM_API_URL || 'https://lmsapi.plagiat.pl').trim();
  private isEnabled = process.env.STRIKE_PLAGIARISM_ENABLED === 'true';
  private PASSING_THRESHOLD = 20.0; // Institutional rule: < 20% similarity

  /**
   * Performs an immediate diagnostic check to verify credentials with StrikePlagiarism.
   */
  async testConnection(): Promise<{ ok: boolean; message: string; statusCode?: number }> {
    if (!this.apiKey) {
      return { ok: false, message: 'STRIKE_PLAGIARISM_API_KEY is not configured.' };
    }

    return new Promise((resolve) => {
      const parsedUrl = new URL(this.apiUrl);
      const req = https.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: `/api/v2/documents?APIKEY=${encodeURIComponent(this.apiKey)}`,
          method: 'GET',
          timeout: 10000,
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => {
            // Note: 400 "Document not found" or 200 means API key is recognized and valid.
            // 403 means invalid API key.
            if (res.statusCode === 200 || (res.statusCode === 400 && data.includes('Document not found'))) {
              resolve({ ok: true, message: '200: Connection OK - StrikePlagiarism API key is valid and active.', statusCode: 200 });
            } else if (res.statusCode === 403) {
              resolve({ ok: false, message: '403: API key rejected by StrikePlagiarism (invalid or unactivated).', statusCode: 403 });
            } else {
              resolve({ ok: false, message: `StrikePlagiarism responded with HTTP ${res.statusCode}: ${data}`, statusCode: res.statusCode });
            }
          });
        }
      );

      req.on('error', (err) => {
        resolve({ ok: false, message: `Network error connecting to StrikePlagiarism: ${err.message}` });
      });

      req.end();
    });
  }

  /**
   * Submits the thesis current manuscript to StrikePlagiarism.
   */
  async submitManuscriptForCheck(thesisId: string): Promise<{ documentId: string; message: string }> {
    if (!this.isEnabled) {
      throw new AppError('STRIKE Plagiarism integration is currently disabled in system settings.', 400);
    }

    const thesis = await this.repo.findThesisById(thesisId);
    if (!thesis || !thesis.student) {
      throw new AppError('Thesis record or associated student profile not found.', 404);
    }

    const manuscript = thesis.thesisDocuments[0];
    if (!manuscript || !manuscript.filePath) {
      throw new AppError('No current manuscript document found for this thesis to verify.', 400);
    }

    const resolvedFilePath = path.resolve(manuscript.filePath);
    if (!fs.existsSync(resolvedFilePath)) {
      throw new AppError(`Manuscript file on disk could not be located at: ${manuscript.filePath}`, 404);
    }

    const fileBuffer = fs.readFileSync(resolvedFilePath);
    if (fileBuffer.length < 50) {
      throw new AppError('Manuscript content is too short for plagiarism verification (minimum 50 characters required).', 400);
    }

    const studentName = `${thesis.student.user.firstName} ${thesis.student.user.lastName}`;
    const manuscriptTitle = manuscript.manuscriptTitle || 'Thesis Manuscript';
    const filename = manuscript.originalFilename || path.basename(resolvedFilePath) || 'manuscript.pdf';

    // Build Multipart Form Payload
    const boundary = '----WebKitFormBoundary' + crypto.randomBytes(16).toString('hex');
    const headerParts: Buffer[] = [];

    const addField = (name: string, value: string) => {
      let part = `--${boundary}\r\n`;
      part += `Content-Disposition: form-data; name="${name}"\r\n\r\n`;
      part += `${value}\r\n`;
      headerParts.push(Buffer.from(part, 'utf-8'));
    };

    addField('APIKEY', this.apiKey);
    addField('languageCode', 'en');
    addField('title', manuscriptTitle);
    addField('author', studentName);
    addField('coordinator', 'EARIST Graduate School');
    addField('action', 'check');

    let fileHeader = `--${boundary}\r\n`;
    fileHeader += `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n`;
    fileHeader += `Content-Type: application/pdf\r\n\r\n`;
    headerParts.push(Buffer.from(fileHeader, 'utf-8'));

    const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
    const fullPayload = Buffer.concat([...headerParts, fileBuffer, footer]);

    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(this.apiUrl);
      const req = https.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: '/api/v2/documents/add',
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': fullPayload.length,
          },
          timeout: 60000,
        },
        (res) => {
          let responseText = '';
          res.on('data', (c) => (responseText += c));
          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                const parsed = JSON.parse(responseText);
                resolve({
                  documentId: parsed.id,
                  message: 'Manuscript successfully submitted to StrikePlagiarism for analysis.',
                });
              } catch (e) {
                reject(new AppError('StrikePlagiarism returned non-JSON response.', 502));
              }
            } else {
              reject(new AppError(`StrikePlagiarism rejected submission: (HTTP ${res.statusCode}) ${responseText}`, 502));
            }
          });
        }
      );

      req.on('error', (err) => {
        reject(new AppError(`Network failure communicating with StrikePlagiarism: ${err.message}`, 502));
      });

      req.write(fullPayload);
      req.end();
    });
  }

  /**
   * Polls StrikePlagiarism for document status and coefficients.
   */
  async getDocumentStatus(documentId: string): Promise<StrikeCheckStatusResponse> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(this.apiUrl);
      const req = https.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: `/api/v2/documents?id=${encodeURIComponent(documentId)}&APIKEY=${encodeURIComponent(this.apiKey)}`,
          method: 'GET',
          timeout: 15000,
        },
        (res) => {
          let responseText = '';
          res.on('data', (c) => (responseText += c));
          res.on('end', () => {
            if (res.statusCode === 200) {
              try {
                const parsed = JSON.parse(responseText);
                const factor1 = Number(parsed.factor1 ?? 0);
                const factor2 = Number(parsed.factor2 ?? 0);
                const highestFactor = Math.max(factor1, factor2);
                const similarityPercentage = Math.round(highestFactor * 100 * 10) / 10;
                const isEligible = similarityPercentage < this.PASSING_THRESHOLD;

                resolve({
                  documentId,
                  isReady: Boolean(parsed['report-ready']),
                  status: parsed.status || 'processing',
                  factor1,
                  factor2,
                  similarityPercentage,
                  isEligible,
                  title: parsed.title,
                  author: parsed.author,
                });
              } catch (e) {
                reject(new AppError('Failed to parse StrikePlagiarism status response.', 502));
              }
            } else {
              reject(new AppError(`Failed to fetch document status: HTTP ${res.statusCode}`, 502));
            }
          });
        }
      );

      req.on('error', (err) => {
        reject(new AppError(`Network error fetching document status: ${err.message}`, 502));
      });

      req.end();
    });
  }

  /**
   * Downloads the complete HTML similarity report from StrikePlagiarism and saves it to local disk.
   */
  async downloadReportFile(documentId: string): Promise<string> {
    const uploadDir = path.resolve('uploads', 'plagiarism');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const targetFilename = `strike-report-${documentId}.html`;
    const targetPath = path.join(uploadDir, targetFilename);

    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(this.apiUrl);
      const req = https.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 443,
          path: `/api/v2/documents/report?id=${encodeURIComponent(documentId)}&APIKEY=${encodeURIComponent(this.apiKey)}`,
          method: 'GET',
          timeout: 30000,
        },
        (res) => {
          const fileStream = fs.createWriteStream(targetPath);
          res.pipe(fileStream);
          fileStream.on('finish', () => {
            fileStream.close();
            // Store relative path for system portability
            const relativePath = path.relative(process.cwd(), targetPath).replace(/\\/g, '/');
            resolve(relativePath);
          });
          fileStream.on('error', (err) => reject(err));
        }
      );

      req.on('error', (err) => reject(err));
      req.end();
    });
  }

  /**
   * Synchronizes an existing StrikePlagiarism document result into the system database.
   */
  async syncAndRecordResult(thesisId: string, documentId: string) {
    const status = await this.getDocumentStatus(documentId);
    if (!status.isReady) {
      return {
        isReady: false,
        status: status.status,
        message: 'Analysis is still in progress at StrikePlagiarism.',
      };
    }

    const savedFilePath = await this.downloadReportFile(documentId);

    const record = await this.repo.createPlagiarismResult({
      thesisId,
      filePath: savedFilePath,
      similarityPercentage: status.similarityPercentage,
      isEligible: status.isEligible,
    });

    return {
      isReady: true,
      record,
      similarityPercentage: status.similarityPercentage,
      isEligible: status.isEligible,
      message: status.isEligible
        ? 'STRIKE similarity clearance successfully recorded (eligible for Final Defense).'
        : 'STRIKE similarity clearance recorded (exceeds 20% institutional threshold; revision required).',
    };
  }

  /**
   * Helper for student to get their active thesis plagiarism status.
   */
  async getStudentPlagiarismStatus(userId: string) {
    const thesis = await this.repo.findActiveThesisForStudent(userId);
    if (!thesis) {
      return { hasThesis: false, result: null };
    }

    const latest = thesis.plagiarismResults[0] ?? null;
    return {
      hasThesis: true,
      thesisId: thesis.id,
      stage: thesis.stage,
      status: thesis.status,
      result: latest
        ? {
            id: latest.id,
            similarityPercentage: Number(latest.similarityPercentage),
            isEligible: latest.isEligible,
            filePath: latest.filePath,
            submittedAt: latest.submittedAt,
          }
        : null,
      currentManuscript: thesis.thesisDocuments[0]
        ? {
            id: thesis.thesisDocuments[0].id,
            title: thesis.thesisDocuments[0].manuscriptTitle,
            filename: thesis.thesisDocuments[0].originalFilename,
            uploadedAt: thesis.thesisDocuments[0].uploadedAt,
          }
        : null,
    };
  }
}
