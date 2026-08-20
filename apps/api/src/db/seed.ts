import { getDatabase, initDatabase } from './connection.js';
import * as schema from './schema/index.js';
import { hashPassword, hashPin } from '../services/crypto.js';
import { eq } from 'drizzle-orm';

export async function runSeed() {
  console.log('[SEED] Initializing PostgreSQL database schema...');
  const { db } = await getDatabase();
  await initDatabase(db);

  // 1. Seed Showroom Shop
  const shopId = '00000000-0000-0000-0000-000000000001';
  const existingShop = await db.select().from(schema.shops).where(eq(schema.shops.id, shopId)).limit(1);

  if (existingShop.length === 0) {
    await db.insert(schema.shops).values({
      id: shopId,
      name: 'Kamal Jewellers — Flagship Showroom',
      code: 'KJ-MAIN',
      address: '104, Zaveri Bazaar, M.G. Road, Mumbai - 400002',
      phone: '+91 98200 12345',
      email: 'contact@kamaljewellers.com',
      gstin: '27AAAAA0000A1Z5',
      taxStatus: 'GST_REGISTERED',
      defaultTaxPercent: '3.00',
      invoicePrefix: 'KJ-2026/',
      termsAndConditions: '1. All gold items hallmarked with unique BIS HUID.\n2. Purity guaranteed by Kamal Jewellers.\n3. Making charges non-refundable on return.'
    });
    console.log('[SEED] Seeded flagship showroom profile.');
  }

  // 2. Seed Users with Cryptographic Hashes (NO PLAINTEXT SECRETS)
  const adminId = '00000000-0000-0000-0000-000000000010';
  const cashierId = '00000000-0000-0000-0000-000000000011';

  const adminPassHash = await hashPassword('password123');
  const adminPinHash = await hashPin('1234');
  const cashierPassHash = await hashPassword('password123');
  const cashierPinHash = await hashPin('5678');

  await db.insert(schema.users).values([
    {
      id: adminId,
      shopId,
      name: 'Kamal Kishore Soni',
      email: 'admin@kamaljewellers.com',
      passwordHash: adminPassHash,
      pinHash: adminPinHash,
      role: 'ADMIN',
      isActive: true
    },
    {
      id: cashierId,
      shopId,
      name: 'Pooja Sharma',
      email: 'pooja@kamaljewellers.com',
      passwordHash: cashierPassHash,
      pinHash: cashierPinHash,
      role: 'CLERK',
      isActive: true
    }
  ]).onConflictDoNothing();
  console.log('[SEED] Seeded cryptographically secured users.');

  // 3. Seed Categories
  const categoryNames = [
    { name: 'Necklace', code: 'NK', makingType: 'PER_GRAM' as const, makingVal: '450.00', wastage: '1.50' },
    { name: 'Bangles', code: 'BG', makingType: 'PER_GRAM' as const, makingVal: '500.00', wastage: '2.00' },
    { name: 'Rings', code: 'RG', makingType: 'FLAT' as const, makingVal: '2500.00', wastage: '0.00' },
    { name: 'Chains', code: 'CH', makingType: 'PER_GRAM' as const, makingVal: '400.00', wastage: '1.00' },
    { name: 'Earrings', code: 'ER', makingType: 'PER_GRAM' as const, makingVal: '480.00', wastage: '1.50' },
    { name: 'Silver Utensils', code: 'SLV', makingType: 'PER_GRAM' as const, makingVal: '15.00', wastage: '0.00' }
  ];

  for (const cat of categoryNames) {
    await db.insert(schema.categories).values({
      shopId,
      name: cat.name,
      code: cat.code,
      defaultMakingType: cat.makingType,
      defaultMakingValue: cat.makingVal,
      defaultWastagePct: cat.wastage
    }).onConflictDoNothing();
  }
  console.log('[SEED] Seeded jewellery categories.');

  // 4. Seed Gold Rates
  await db.insert(schema.goldRates).values({
    shopId,
    rate24k: '7450.00',
    rate22k: '6980.00',
    rate18k: '5720.00',
    rateSilver: '88.50',
    ratePlatinum: '3150.00',
    createdBy: adminId,
    createdByName: 'Kamal Kishore Soni'
  }).onConflictDoNothing();
  console.log('[SEED] Seeded live bullion board rates.');

  // 5. Seed Canonical Jewellery Items (`jewellery_items`)
  const seedItems = [
    {
      id: '00000000-0000-0000-0000-000000000101',
      shopId,
      itemCode: 'KJ-GLD-NK-001',
      category: 'Necklace',
      designTitle: '22K Calcutta Filigree Bridal Necklace',
      metal: 'GOLD' as const,
      purity: '22K',
      grossWeight: '45.800',
      stoneWeight: '0.000',
      netWeight: '45.800',
      huid: 'AH8921',
      hallmarkVerified: true,
      makingChargeType: 'PER_GRAM' as const,
      makingChargeValue: '450.00',
      wastagePct: '1.50',
      stoneValue: '0.00',
      status: 'IN_STOCK' as const,
      notes: 'Handcrafted master bridal collection piece'
    },
    {
      id: '00000000-0000-0000-0000-000000000102',
      shopId,
      itemCode: 'KJ-GLD-BG-002',
      category: 'Bangles',
      designTitle: '22K Antique Peacock Kada Bangles (Pair)',
      metal: 'GOLD' as const,
      purity: '22K',
      grossWeight: '28.350',
      stoneWeight: '0.500',
      netWeight: '27.850',
      huid: 'KJ9162',
      hallmarkVerified: true,
      makingChargeType: 'PER_GRAM' as const,
      makingChargeValue: '500.00',
      wastagePct: '2.00',
      stoneValue: '0.00',
      status: 'IN_STOCK' as const,
      notes: 'Traditional temple finish ruby stone studded'
    },
    {
      id: '00000000-0000-0000-0000-000000000103',
      shopId,
      itemCode: 'KJ-GLD-RG-003',
      category: 'Rings',
      designTitle: '18K Diamond Solitaire Engagement Ring',
      metal: 'GOLD' as const,
      purity: '18K',
      grossWeight: '4.250',
      stoneWeight: '0.400',
      netWeight: '3.850',
      huid: 'DM1804',
      hallmarkVerified: true,
      makingChargeType: 'FLAT' as const,
      makingChargeValue: '2500.00',
      wastagePct: '0.00',
      stoneValue: '45000.00',
      status: 'IN_STOCK' as const,
      notes: 'VVS-EF certified central diamond 0.50ct'
    },
    {
      id: '00000000-0000-0000-0000-000000000104',
      shopId,
      itemCode: 'KJ-SLV-UT-004',
      category: 'Silver Utensils',
      designTitle: '999 Fine Silver Royal Puja Thali Set',
      metal: 'SILVER' as const,
      purity: 'Silver 999',
      grossWeight: '350.000',
      stoneWeight: '0.000',
      netWeight: '350.000',
      huid: 'SLV999',
      hallmarkVerified: true,
      makingChargeType: 'PER_GRAM' as const,
      makingChargeValue: '15.00',
      wastagePct: '0.00',
      stoneValue: '0.00',
      status: 'IN_STOCK' as const,
      notes: 'Pure silver 5-piece traditional festive thali'
    },
    {
      id: '00000000-0000-0000-0000-000000000105',
      shopId,
      itemCode: 'KJ-GLD-ER-005',
      category: 'Earrings',
      designTitle: '22K Traditional Temple Jhumkas',
      metal: 'GOLD' as const,
      purity: '22K',
      grossWeight: '12.600',
      stoneWeight: '0.200',
      netWeight: '12.400',
      huid: 'JH2291',
      hallmarkVerified: true,
      makingChargeType: 'PER_GRAM' as const,
      makingChargeValue: '480.00',
      wastagePct: '1.50',
      stoneValue: '0.00',
      status: 'IN_STOCK' as const,
      notes: 'Classic floral drop jhumka with south screw'
    },
    {
      id: '00000000-0000-0000-0000-000000000106',
      shopId,
      itemCode: 'KJ-GLD-CH-006',
      category: 'Chains',
      designTitle: '22K Royal Rope Mens Gold Chain',
      metal: 'GOLD' as const,
      purity: '22K',
      grossWeight: '22.150',
      stoneWeight: '0.000',
      netWeight: '22.150',
      huid: 'CH9921',
      hallmarkVerified: true,
      makingChargeType: 'PER_GRAM' as const,
      makingChargeValue: '400.00',
      wastagePct: '1.00',
      stoneValue: '0.00',
      status: 'IN_STOCK' as const,
      notes: '24-inch sturdy machine rope design'
    }
  ];

  for (const item of seedItems) {
    await db.insert(schema.jewelleryItems).values(item).onConflictDoNothing();
  }
  console.log('[SEED] Seeded canonical jewellery items in vault inventory.');

  // 6. Seed Customers & Khata Ledgers
  const cust1Id = '00000000-0000-0000-0000-000000000201';
  const cust2Id = '00000000-0000-0000-0000-000000000202';
  const cust3Id = '00000000-0000-0000-0000-000000000203';

  await db.insert(schema.customers).values([
    {
      id: cust1Id,
      shopId,
      name: 'Smt. Kavita Mehta',
      mobile: '9820011223',
      email: 'kavita.mehta@example.com',
      pan: 'ABCDE1234F',
      address: '12B, Sea Face Road, Malabar Hill',
      city: 'Mumbai',
      stateCode: '27',
      ledgerBalance: '0.00',
      totalPurchases: '540000.00'
    },
    {
      id: cust2Id,
      shopId,
      name: 'Shri Rajesh Verma',
      mobile: '9819944332',
      email: 'rajesh.verma@example.com',
      pan: 'BNMPK5678Q',
      address: '402, Lotus Grandeur, Veera Desai, Andheri West',
      city: 'Mumbai',
      stateCode: '27',
      ledgerBalance: '25000.00',
      totalPurchases: '245000.00'
    },
    {
      id: cust3Id,
      shopId,
      name: 'Vikram Singhania',
      mobile: '9769012345',
      email: 'vikram.singhania@example.com',
      pan: 'XYZPS9988L',
      address: '8, Pali Hill, Bandra West',
      city: 'Mumbai',
      stateCode: '27',
      ledgerBalance: '0.00',
      totalPurchases: '120000.00'
    }
  ]).onConflictDoNothing();

  // Seed Ledger Entry for Rajesh Verma's balance
  await db.insert(schema.customerLedgerEntries).values({
    shopId,
    customerId: cust2Id,
    type: 'INVOICE_BALANCE_DUE',
    referenceNo: 'KJ-2026/00098',
    description: 'Part payment balance on Gold Chain billing',
    debit: '25000.00',
    credit: '0.00',
    runningBalance: '25000.00'
  }).onConflictDoNothing();

  console.log('[SEED] Seeded customer profiles and khata ledger records.');
  console.log('[SEED] Database seed completed successfully!');
}

// Execute directly if run via CLI
runSeed().then(() => {
  console.log('[SEED] Done!');
  process.exit(0);
}).catch((err) => {
  console.error('[SEED FATAL ERROR]:', err);
  process.exit(1);
});
