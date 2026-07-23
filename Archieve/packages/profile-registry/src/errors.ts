export class ProfileValidationError extends Error {
  constructor(
    message: string,
    readonly tenantId: string,
    readonly subject: string,
  ) {
    super(message);
    this.name = "ProfileValidationError";
  }
}
