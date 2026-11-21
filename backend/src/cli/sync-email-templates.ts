import "dotenv/config";
import prisma from "../config/database";
import {
  EMAIL_TEMPLATE_REGISTRY,
  RETIRED_EMAIL_TEMPLATE_KEYS,
} from "../config/email-templates.registry";

async function main() {
  const deleted = await prisma.emailTemplate.deleteMany({
    where: {
      templateKey: {
        in: [...RETIRED_EMAIL_TEMPLATE_KEYS],
      },
    },
  });

  for (const tpl of EMAIL_TEMPLATE_REGISTRY) {
    await prisma.emailTemplate.upsert({
      where: { templateKey: tpl.templateKey },
      update: {
        variablesDescription: tpl.variablesDescription,
      },
      create: {
        templateKey: tpl.templateKey,
        subject: tpl.defaultSubject,
        bodyHtml: tpl.defaultBodyHtml,
        variablesDescription: tpl.variablesDescription,
        isActive: true,
      },
    });
  }

  // Also refresh legacy templates that still had pre-refactor placeholder wording
  for (const tpl of EMAIL_TEMPLATE_REGISTRY) {
    await prisma.emailTemplate.updateMany({
      where: {
        templateKey: tpl.templateKey,
        updatedById: null,
      },
      data: {
        subject: tpl.defaultSubject,
        bodyHtml: tpl.defaultBodyHtml,
        variablesDescription: tpl.variablesDescription,
      },
    });
  }

  const total = await prisma.emailTemplate.count();
  console.log(
    `[EmailTemplates] Removed ${deleted.count} retired template(s); active canonical templates in DB: ${total}.`,
  );
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error("[EmailTemplates] Sync failed:", error);
  await prisma.$disconnect();
  process.exit(1);
});
