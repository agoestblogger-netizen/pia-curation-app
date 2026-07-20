import { db } from './index';
import { eq, inArray } from 'drizzle-orm';
import {
  users,
  competitions,
  proposals,
  scoringCriteria,
  curationBatches,
  curatorAssignments,
  screeningResults,
} from './schema';
import { SCREENING_VERDICTS } from '../constants/screening';
import bcrypt from 'bcrypt';

async function seed() {
  console.log('Seeding database...');

  const passwordHash = await bcrypt.hash('password123', 10);

  // 1. Create Users
  const [coordinator] = await db.insert(users).values({
    name: 'Panitia Pusat',
    email: 'panitia@pia.id',
    passwordHash,
    roles: ['coordinator'],
  }).returning();

  const curators = await db.insert(users).values(
    Array.from({ length: 10 }).map((_, i) => ({
      name: `Kurator ${i + 1}`,
      email: `kurator${i + 1}@pia.id`,
      passwordHash,
      roles: ['curator'],
    }))
  ).returning();

  const promoters = await db.insert(users).values(
    Array.from({ length: 5 }).map((_, i) => ({
      name: `Promotor ${i + 1}`,
      email: `promotor${i + 1}@pia.id`,
      passwordHash,
      roles: ['promoter'],
    }))
  ).returning();

  const sponsors = await db.insert(users).values(
    Array.from({ length: 3 }).map((_, i) => ({
      name: `Sponsor ${i + 1}`,
      email: `sponsor${i + 1}@pia.id`,
      passwordHash,
      roles: ['sponsor'],
    }))
  ).returning();

  // 2. Create Active Competition
  const [competition] = await db.insert(competitions).values({
    name: 'Pegadaian Innovation Award',
    year: 2026,
    description: 'Seed Data Competition',
    phase: 'imported',
    createdBy: coordinator.id,
  }).returning();

  // 3. Create Proposals (2000 total)
  // Distribution: 800 WILAYAH, 400 PUSAT, 400 BI, 400 BC
  const proposalData = [];
  
  for (let i = 1; i <= 800; i++) {
    proposalData.push({
      competitionId: competition.id,
      externalId: `WLY-${i}`,
      title: `Inovasi Wilayah ${i}: Efisiensi Operasional`,
      proposerName: `Pegawai WLY ${i}`,
      proposerOrg: `Regional ${i % 4 + 1}`,
      category: 'WILAYAH',
      status: 'imported',
      importedBy: coordinator.id,
    });
  }

  for (let i = 1; i <= 400; i++) {
    proposalData.push({
      competitionId: competition.id,
      externalId: `PST-${i}`,
      title: `Inovasi Pusat ${i}: Digitalisasi Layanan`,
      proposerName: `Pegawai PST ${i}`,
      proposerOrg: `Divisi IT`,
      category: 'PUSAT',
      status: 'imported',
      importedBy: coordinator.id,
    });
  }

  for (let i = 1; i <= 400; i++) {
    proposalData.push({
      competitionId: competition.id,
      externalId: `BI-${i}`,
      title: `Business Idea ${i}: Model Bisnis Baru`,
      proposerName: `Pegawai BI ${i}`,
      proposerOrg: `Komersial`,
      category: 'BI',
      status: 'imported',
      importedBy: coordinator.id,
    });
  }

  for (let i = 1; i <= 400; i++) {
    proposalData.push({
      competitionId: competition.id,
      externalId: `BC-${i}`,
      title: `Business Case ${i}: Pengembangan Ekosistem`,
      proposerName: `Pegawai BC ${i}`,
      proposerOrg: `Strategi`,
      category: 'BC',
      status: 'imported',
      importedBy: coordinator.id,
    });
  }

  // Insert in chunks of 500
  console.log('Inserting 2000 proposals...');
  for (let i = 0; i < proposalData.length; i += 500) {
    await db.insert(proposals).values(proposalData.slice(i, i + 500));
  }

  // 4. Create Scoring Criteria
  await db.insert(scoringCriteria).values([
    {
      competitionId: competition.id,
      name: 'Orisinalitas & Inovasi',
      maxScore: 100,
      weight: 0.3,
      orderIndex: 1,
      createdBy: coordinator.id,
    },
    {
      competitionId: competition.id,
      name: 'Dampak Bisnis',
      maxScore: 100,
      weight: 0.4,
      orderIndex: 2,
      createdBy: coordinator.id,
    },
    {
      competitionId: competition.id,
      name: 'Kelayakan Implementasi',
      maxScore: 100,
      weight: 0.3,
      orderIndex: 3,
      createdBy: coordinator.id,
    },
  ]);

  // 5. Seed Screening Results for UI Testing
  console.log('Seeding screening results...');
  // Create a dummy batch
  const [batch] = await db.insert(curationBatches).values({
    competitionId: competition.id,
    name: 'Batch Dummy Screening',
    assignmentMode: 'equal',
    status: 'locked',
    createdBy: coordinator.id,
  }).returning();

  const first25Proposals = await db.select({ id: proposals.id, category: proposals.category }).from(proposals).limit(25);
  const dummyAssignments = first25Proposals.map((p) => ({
    batchId: batch.id,
    proposalId: p.id,
    curatorId: curators[0].id,
    category: p.category,
    status: 'completed',
  }));
  const insertedAssignments = await db.insert(curatorAssignments).values(dummyAssignments).returning();

  const dummyScreenings = insertedAssignments.map((a, i) => {
    // Distribute into 5 statuses + a few uncompleted
    const verdict = SCREENING_VERDICTS[i % 5];
    return {
      assignmentId: a.id,
      proposalId: a.proposalId,
      curatorId: a.curatorId,
      verdict: verdict,
      notes: `Catatan dummy untuk verdict ${verdict}`,
    };
  });
  
  await db.insert(screeningResults).values(dummyScreenings);
  
  // Update proposal status for 'lolos'
  const lolosIds = dummyScreenings.filter(s => s.verdict === 'lolos').map(s => s.proposalId);
  const rejectedIds = dummyScreenings.filter(s => s.verdict !== 'lolos').map(s => s.proposalId);
  
  if (lolosIds.length > 0) {
    await db.update(proposals).set({ status: 'curation_passed' }).where(inArray(proposals.id, lolosIds));
  }
  if (rejectedIds.length > 0) {
    await db.update(proposals).set({ status: 'curation_rejected' }).where(inArray(proposals.id, rejectedIds));
  }

  console.log('Database seeded successfully!');
}

seed().catch((err) => {
  console.error('Failed to seed:', err);
  process.exit(1);
});
