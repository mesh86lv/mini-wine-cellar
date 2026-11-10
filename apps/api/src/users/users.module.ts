import { Module } from "@nestjs/common";
import { UsersResolver } from "./users.resolver";
import { UsersService } from "./users.service";

@Module({
  providers: [UsersResolver, UsersService],
  // The auth guard resolves the caller through this service.
  exports: [UsersService],
})
export class UsersModule {}
