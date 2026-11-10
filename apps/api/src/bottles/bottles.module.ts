import { Module } from "@nestjs/common";
import { CurrentUserGuard } from "../auth/current-user.guard";
import { UsersModule } from "../users/users.module";
import { BottlesResolver } from "./bottles.resolver";
import { BottlesService } from "./bottles.service";

@Module({
  // The guard resolves the caller through `UsersService`.
  imports: [UsersModule],
  providers: [BottlesResolver, BottlesService, CurrentUserGuard],
})
export class BottlesModule {}
