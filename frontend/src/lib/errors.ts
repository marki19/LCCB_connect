export class ApiError extends Error {
  status: number;
  code?: string;
  /** Raw response body, when the server sent JSON. Carries validation
   *  `fields[]` that `validate()` in the backend produces — without this the
   *  client would have to guess field names from the message string. */
  body?: any;
  constructor(message: string, status: number, code?: string, body?: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.body = body;
  }
}
