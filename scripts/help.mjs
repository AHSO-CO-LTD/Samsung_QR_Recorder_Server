const groups = [
  {
    title: "Setup",
    commands: [
      ["npm run setup", "Cài dependency và generate Prisma Client"],
      ["npm run install:all", "Cài lại toàn bộ dependency"],
      ["npm run reset", "Clean build cache, npm install, Prisma generate"],
      ["npm run clean", "Xóa dist/.next/release cache"]
    ]
  },
  {
    title: "Development",
    commands: [
      ["npm run dev", "Chạy API, Web và Electron"],
      ["npm run dev:api", "Chạy NestJS API"],
      ["npm run dev:web", "Chạy Next.js UI"],
      ["npm run dev:desktop", "Chạy desktop app thật, hỏi quyền Admin, dọn port, API/Web ngầm"],
      ["npm run dev:ui", "Debug UI: chạy Web rồi mở Electron, không chạy API"],
      ["npm run dev:electron", "Chỉ mở Electron khi UI đã chạy sẵn"]
    ]
  },
  {
    title: "Build and Check",
    commands: [
      ["npm run build", "Build toàn bộ workspace"],
      ["npm run check", "Validate Prisma và build toàn bộ"],
      ["npm run build:api", "Build backend"],
      ["npm run build:web", "Build frontend"],
      ["npm run build:desktop", "Build Electron"],
      ["npm run build:shared", "Build shared"]
    ]
  },
  {
    title: "Database",
    commands: [
      ["npm run db:validate", "Validate Prisma schema"],
      ["npm run db:generate", "Generate Prisma Client"],
      ["npm run db:migrate", "Tạo/chạy migration dev"],
      ["npm run db:deploy", "Deploy migration production"],
      ["npm run db:studio", "Mở Prisma Studio"],
      ["npm run db:seed", "Seed tài khoản admin/dev"]
    ]
  },
  {
    title: "Add Packages",
    commands: [
      ["npm run add:web -- recharts", "Cài package cho frontend"],
      ["npm run add:api -- @nestjs/jwt", "Cài package cho backend"],
      ["npm run add:desktop -- electron-updater", "Cài package cho Electron"],
      ["npm run add:shared -- zod", "Cài package cho shared"],
      ["npm run add:root -- -D eslint", "Cài package ở root"]
    ]
  }
];

for (const group of groups) {
  console.log(`\n${group.title}`);
  for (const [command, note] of group.commands) {
    console.log(`  ${command.padEnd(36)} ${note}`);
  }
}
