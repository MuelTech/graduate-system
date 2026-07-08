import { DatabankRepository } from "../repositories/databank.repository";

// Helper function to strip sensitive data for public/unauthenticated users
function stripPayload(entry: any) {
  if (!entry) return null;
  const stripped = { ...entry };
  delete stripped.fullPaperPath;
  delete stripped.respondentDataPath;

  // Strip paths from nested thesis documents as an extra layer of security
  if (stripped.thesis?.thesisDocuments) {
    stripped.thesis.thesisDocuments = stripped.thesis.thesisDocuments.map(
      (doc: any) => {
        const safeDoc = { ...doc };
        delete safeDoc.filePath;
        return safeDoc;
      },
    );
  }

  return stripped;
}

export class DatabankService {
  private repository = new DatabankRepository();

  async createEntry(data: {
    thesisId: string;
    title: string;
    abstract?: string;
    fullPaperPath?: string;
    respondentDataPath?: string;
    keywords?: string;
  }) {
    return this.repository.createEntry(data);
  }

  async getAllEntries(userRole: string) {
    if (userRole !== "ADMIN") {
      throw new Error(
        "Unauthorized: Only admin can view the complete databank queue.",
      );
    }

    return this.repository.findAll();
  }

  async searchPublic(searchQuery: string | undefined, userRole: string | null) {
    // Strict Applicant Block
    if (userRole === "APPLICANT") {
      throw new Error(
        "Unauthorized: Applicants do not have access to the Research Repository.",
      );
    }

    const entries = await this.repository.searchPublic(searchQuery);

    // Unauthenticated Public Access: Strip download URLs
    if (!userRole) {
      return entries.map(stripPayload);
    }

    // Students, Panelists, and Admins: Full Payload
    return entries;
  }

  async getEntryById(id: string, userRole: string | null) {
    if (userRole === "APPLICANT") {
      throw new Error(
        "Unauthorized: Applicants do not have access to the Research Repository.",
      );
    }
    const entry = await this.repository.findById(id);
    if (!entry) throw new Error("Entry not found.");
    if (!userRole) {
      return stripPayload(entry);
    }
    return entry;
  }
  
  async approveAndPublish(id: string, adminId: string) {
    return this.repository.updateEntry(id, {
      isPublic: true,
      publishedAt: new Date(),
      approvedById: adminId,
    });
  }

  async unpublish(id: string) {
    return this.repository.updateEntry(id, {
      isPublic: false,
    });
  }

  async editMetadata(
    id: string,
    data: { title?: string; abstract?: string; keywords?: string },
  ) {
    return this.repository.updateEntry(id, data);
  }
}
