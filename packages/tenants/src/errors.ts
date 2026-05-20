export class TenantNotFoundError extends Error {
  constructor(id: string) {
    super(`tenant not found: ${id}`);
    this.name = "TenantNotFoundError";
  }
}

export class TenantConflictError extends Error {
  constructor(id: string) {
    super(`tenant already exists: ${id}`);
    this.name = "TenantConflictError";
  }
}

export class InvalidTenantIdError extends Error {
  constructor(id: string) {
    super(`invalid tenant id "${id}": use lowercase letters, numbers, underscores, and hyphens`);
    this.name = "InvalidTenantIdError";
  }
}
