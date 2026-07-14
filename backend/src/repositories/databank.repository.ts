import prisma from '../config/database';

export class DatabankRepository {
    async createEntry(data: {
        thesisId: string;
        title: string;
        abstract?: string;
        fullPaperPath?: string;
        respondentDataPath?: string;
        keywords?: string;
    }) {
        return prisma.eLibrary.create({
            data: {
                thesisId: data.thesisId,
                title: data.title,
                abstract: data.abstract,
                fullPaperPath: data.fullPaperPath,
                respondentDataPath: data.respondentDataPath,
                keywords: data.keywords,
                isPublic: false,
            },
        });
    }

    async findAll() {
        return prisma.eLibrary.findMany({
            include: {
                thesis: {
                    include: {
                        student: {
                            include: {
                                user: {
                                    select: {
                                        firstName: true,
                                        lastName: true
                                    }
                                },
                                program: {
                                    select: {
                                        programName: true
                                    }
                                },
                            },
                        },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }

    async searchPublic(searchQuery?: string) {
        return prisma.eLibrary.findMany({
            where: {
                isPublic: true,
                OR: searchQuery ? [
                    { title: { contains: searchQuery } },
                    { keywords: { contains: searchQuery } },
                    {
                        thesis: {
                            student: {
                                user: {
                                    OR: [
                                        { firstName: { contains: searchQuery } },
                                        { lastName: { contains: searchQuery } },
                                    ],
                                },
                            },
                        },
                    },
                    {
                        thesis: {
                            student: {
                                program: {
                                    programName: { contains: searchQuery },
                                },
                            },
                        },
                    },
                ] : undefined,
            },
            include: {
                thesis: {
                    include: {
                        student: {
                            include: {
                                user: {
                                    select: {
                                        firstName: true,
                                        lastName: true
                                    }
                                },
                                program: {
                                    select: {
                                        programName: true
                                    }
                                },
                            },
                        },
                    },
                },
            },
            orderBy: {
                publishedAt: "desc"
            },
        });
    }

    // unified payload with ALL research instruments and certifications
    async findById(id: string) {
        return prisma.eLibrary.findUnique({
            where: { id },
            include: {
                thesis: {
                    include: {
                        student: {
                            include: {
                                user: {
                                    select: {
                                        firstName: true,
                                        lastName: true
                                    }
                                },
                                program: {
                                    select: {
                                        programName: true
                                    }
                                },
                            },
                        },
                        thesisDocuments: true,
                        adviserCertifications: true,
                        statisticianCertification: true,
                        grammarianCertification: true,
                        researchVariableForms: true,
                    },
                },
            },
        });
    }

    async updateEntry(
        id: string,
        data: {
            isPublic?: boolean;
            publishedAt?: Date | null;
            approvedById?: string;
            title?: string;
            abstract?: string;
            keywords?: string;
        }
    ) {
        return prisma.eLibrary.update({
            where: { id },
            data,
        });
    }
}