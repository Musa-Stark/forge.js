/** The identity attached to `req.user` by the authentication middleware. */
export interface AuthenticatedUser {
  _id: string;
  role?: string | undefined;
}
