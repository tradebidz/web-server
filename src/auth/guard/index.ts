import { AuthGuard } from "@nestjs/passport";

export class AtGuard extends AuthGuard("jwt") {}
export class RtGuard extends AuthGuard("jwt-refresh") {}