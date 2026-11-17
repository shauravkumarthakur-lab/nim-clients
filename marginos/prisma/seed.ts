import { PrismaClient } from "@prisma/client";
import { seedDemo } from "../src/lib/demo/seed";
import { DEMO } from "../src/lib/demo/populate";

const db = new PrismaClient();
seedDemo(db)
  .then((s) => {
    console.log("Demo organisation seeded:", s);
    console.log(`  Owner login:  ${DEMO.ownerEmail} / ${DEMO.ownerPassword}`);
    console.log(`  Portal login: ${DEMO.portalEmail} / ${DEMO.portalPassword}`);
  })
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
