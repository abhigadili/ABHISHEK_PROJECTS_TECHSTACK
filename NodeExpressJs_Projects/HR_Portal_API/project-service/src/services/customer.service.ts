import { ConflictError, Db, Row, audit, toColumns, toDto, toDtoPage, toDtos, pageRequest, BusinessRuleError } from '@hr/common';
import { ContactRepository, CustomerRepository } from '../repositories/project.repository';

// customers.tax_number is encrypted by the Java service; this service neither reads nor writes it.
const CUSTOMER_FIELDS = ['id', 'code', 'name', 'industry', 'website', 'billingEmail', 'billingAddress', 'paymentTermsDays', 'creditLimit', 'status', 'notes', 'createdAt', 'updatedAt'];

export class CustomerService {
  private readonly customers: CustomerRepository; private readonly contacts: ContactRepository;
  constructor(private readonly db: Db) { this.customers = new CustomerRepository(db); this.contacts = new ContactRepository(db); }

  async list(q: Row) { return toDtoPage(await this.customers.page(q.status ? { status: q.status } : {}, pageRequest(q), q.q), CUSTOMER_FIELDS); }
  async get(id: string) {
    const c = await this.customers.getById(id, 'Customer');
    const [contacts, projects] = await Promise.all([this.contacts.findAll({ customer_id: id }, { by: 'created_at' }), this.db.query('SELECT id, code, name, status FROM projects WHERE customer_id = ? AND deleted = 0 ORDER BY start_date DESC', [id])]);
    return { ...toDto(c, CUSTOMER_FIELDS), contacts: toDtos(contacts, ['id', 'name', 'email', 'phone', 'designation', 'isPrimary']), projects: toDtos(projects) };
  }
  private row(dto: Row): Row { return toColumns(dto); }
  async create(dto: Row) {
    if (await this.customers.findOne({ code: dto.code })) throw new ConflictError('Customer code already exists');
    const c = await this.customers.insert(this.row(dto)); await audit(this.db, undefined, 'Customer', c.id, 'CREATED', undefined, { code: dto.code });
    return toDto(c, CUSTOMER_FIELDS);
  }
  async update(id: string, dto: Row) {
    const before = await this.customers.getById(id, 'Customer');
    if (dto.code && dto.code !== before.code && (await this.customers.findOne({ code: dto.code }))) throw new ConflictError('Customer code already exists');
    await this.customers.update(id, this.row(dto)); await audit(this.db, undefined, 'Customer', id, 'UPDATED', toDto(before, CUSTOMER_FIELDS), dto);
    return toDto(await this.customers.getById(id), CUSTOMER_FIELDS);
  }
  async remove(id: string) {
    await this.customers.getById(id, 'Customer');
    if (await this.db.scalar<number>("SELECT COUNT(*) FROM projects WHERE customer_id = ? AND deleted = 0 AND status IN ('PLANNED','ACTIVE','ON_HOLD')", [id]).then(Number)) throw new BusinessRuleError('Customer still has open projects');
    await this.customers.remove(id); await audit(this.db, undefined, 'Customer', id, 'DELETED');
  }

  listContacts(customerId: string) { return this.contacts.findAll({ customer_id: customerId }, { by: 'created_at' }).then((r) => toDtos(r, ['id', 'name', 'email', 'phone', 'designation', 'isPrimary'])); }
  async addContact(customerId: string, dto: Row) {
    await this.customers.getById(customerId, 'Customer');
    const c = await this.db.tx(async (conn) => {
      if (dto.primary) await this.db.exec('UPDATE customer_contacts SET is_primary = 0 WHERE customer_id = ?', [customerId], conn);
      return this.contacts.insert({ customer_id: customerId, name: dto.name, email: dto.email ?? null, phone: dto.phone ?? null, designation: dto.designation ?? null, is_primary: dto.primary ? 1 : 0 }, conn);
    });
    return toDto(c, ['id', 'name', 'email', 'phone', 'designation', 'isPrimary']);
  }
  async updateContact(customerId: string, id: string, dto: Row) {
    if (!(await this.contacts.findOne({ id, customer_id: customerId }))) throw new BusinessRuleError('Contact does not belong to this customer');
    await this.db.tx(async (conn) => {
      if (dto.primary) await this.db.exec('UPDATE customer_contacts SET is_primary = 0 WHERE customer_id = ?', [customerId], conn);
      await this.contacts.update(id, { name: dto.name, email: dto.email, phone: dto.phone, designation: dto.designation, ...(dto.primary !== undefined ? { is_primary: dto.primary ? 1 : 0 } : {}) }, conn);
    });
    return toDto(await this.contacts.getById(id), ['id', 'name', 'email', 'phone', 'designation', 'isPrimary']);
  }
  async removeContact(customerId: string, id: string) {
    if (!(await this.contacts.findOne({ id, customer_id: customerId }))) throw new BusinessRuleError('Contact does not belong to this customer');
    await this.contacts.remove(id);
  }
}
