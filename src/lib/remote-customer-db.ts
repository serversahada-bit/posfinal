import mysql, { Pool, RowDataPacket } from 'mysql2/promise';

declare global {
  // eslint-disable-next-line no-var
  var remoteCustomerPool: Pool | undefined;
}

type RemoteCustomerRow = RowDataPacket & {
  id_customer: number;
  nama_customer: string | null;
  alamat_customer: string | null;
  hp_customer: string | null;
  desa: string | null;
  kecamatan: string | null;
  kabupaten: string | null;
  provinsi: string | null;
  kode_customer: string | null;
  tgl_reg: Date | null;
  tgl_terakhir: Date | null;
};

const requiredConfig = [
  'CUSTOMER_DB_HOST',
  'CUSTOMER_DB_USER',
  'CUSTOMER_DB_PASSWORD',
  'CUSTOMER_DB_NAME',
] as const;

const getRemoteCustomerPool = () => {
  const missing = requiredConfig.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Remote customer DB config is incomplete: ${missing.join(', ')}`);
  }

  if (!global.remoteCustomerPool) {
    global.remoteCustomerPool = mysql.createPool({
      host: process.env.CUSTOMER_DB_HOST,
      port: Number(process.env.CUSTOMER_DB_PORT || 3306),
      user: process.env.CUSTOMER_DB_USER,
      password: process.env.CUSTOMER_DB_PASSWORD,
      database: process.env.CUSTOMER_DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
  }

  return global.remoteCustomerPool;
};

export const normalizeWhatsappCandidates = (value: string) => {
  const digits = value.replace(/[^0-9]/g, '');
  const variants = new Set<string>();

  if (!digits) {
    return [];
  }

  variants.add(digits);

  if (digits.startsWith('62')) {
    variants.add(`0${digits.slice(2)}`);
  } else if (digits.startsWith('0')) {
    variants.add(`62${digits.slice(1)}`);
  } else if (digits.startsWith('8')) {
    variants.add(`0${digits}`);
    variants.add(`62${digits}`);
  }

  return Array.from(variants).filter(Boolean);
};

export const mapRemoteCustomer = (customer: RemoteCustomerRow) => ({
  id: customer.id_customer,
  text: `${customer.nama_customer || 'Tanpa Nama'} - ${customer.hp_customer || 'No WA'}`,
  name: customer.nama_customer || '',
  whatsapp_number: customer.hp_customer || '',
  email: '',
  address: customer.alamat_customer || '',
  subdistrict: customer.kecamatan || '',
  desa: customer.desa || '',
  city: customer.kabupaten || '',
  province: customer.provinsi || '',
  registered_at: customer.tgl_reg,
});

export const searchRemoteCustomers = async (query: string) => {
  const pool = getRemoteCustomerPool();
  const trimmed = query.trim();

  const sql = trimmed === ''
    ? `
      SELECT id_customer, nama_customer, alamat_customer, hp_customer, desa, kecamatan, kabupaten, provinsi, kode_customer, tgl_reg, tgl_terakhir
      FROM data_customer
      ORDER BY COALESCE(tgl_reg, tgl_terakhir) DESC, id_customer DESC
      LIMIT 50
    `
    : `
      SELECT id_customer, nama_customer, alamat_customer, hp_customer, desa, kecamatan, kabupaten, provinsi, kode_customer, tgl_reg, tgl_terakhir
      FROM data_customer
      WHERE nama_customer LIKE ? 
         OR hp_customer LIKE ?
         OR hp_customer IN (SELECT contack FROM data_transaksi WHERE kode_booking = ?)
         OR hp_customer IN (SELECT CONCAT('+', contack) FROM data_transaksi WHERE kode_booking = ?)
      ORDER BY COALESCE(tgl_reg, tgl_terakhir) DESC, id_customer DESC
      LIMIT 50
    `;

  const params = trimmed === '' ? [] : [`%${trimmed}%`, `%${trimmed}%`, trimmed, trimmed];
  const [rows] = await pool.query<RemoteCustomerRow[]>(sql, params);
  return rows.map(mapRemoteCustomer);
};

export const findRemoteCustomerByWhatsapp = async (whatsapp: string) => {
  const pool = getRemoteCustomerPool();
  const candidates = normalizeWhatsappCandidates(whatsapp);

  if (candidates.length === 0) {
    return null;
  }

  const placeholders = candidates.map(() => '?').join(', ');
  const [rows] = await pool.query<RemoteCustomerRow[]>(
    `
      SELECT id_customer, nama_customer, alamat_customer, hp_customer, desa, kecamatan, kabupaten, provinsi, kode_customer, tgl_reg, tgl_terakhir
      FROM data_customer
      WHERE hp_customer IN (${placeholders})
      ORDER BY COALESCE(tgl_reg, tgl_terakhir) DESC, id_customer DESC
      LIMIT 1
    `,
    candidates,
  );

  return rows[0] ? mapRemoteCustomer(rows[0]) : null;
};
