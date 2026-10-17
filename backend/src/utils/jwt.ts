import jwt from "jsonwebtoken";

/**
 * CDW-8A: shared access-token verification for REST and Socket.IO.
 *
 * Both transports authenticate with the same JWT_SECRET and the same
 * `userId + role` identity contract. Keeping this in one place prevents the
 * socket handshake from drifting away from REST authentication semantics.
 */
export interface AuthenticatedIdentity {
  userId: string;
  role: string;
}

export class JwtConfigurationError extends Error {
  constructor(message = "JWT_SECRET environment variable is not defined") {
    super(message);
    this.name = "JwtConfigurationError";
  }
}

export class JwtVerificationError extends Error {
  constructor(message = "Invalid or expired authentication token") {
    super(message);
    this.name = "JwtVerificationError";
  }
}

export function verifyAccessToken(
  token: string,
  secret: string | undefined = process.env.JWT_SECRET,
): AuthenticatedIdentity {
  if (!secret) {
    throw new JwtConfigurationError();
  }

  let decoded: string | jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, secret);
  } catch {
    throw new JwtVerificationError();
  }

  if (
    typeof decoded === "string" ||
    !decoded ||
    typeof decoded.userId !== "string" ||
    decoded.userId.length === 0 ||
    typeof decoded.role !== "string" ||
    decoded.role.length === 0
  ) {
    throw new JwtVerificationError();
  }

  return { userId: decoded.userId, role: decoded.role };
}
