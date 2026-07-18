import { Module } from "@nestjs/common";
import { AdminController } from "../modules/auth/admin.controller";
import { AuthController } from "../modules/auth/auth.controller";
import { MockAuthService } from "../modules/auth/mock-auth.service";
import { MockRestaurantService } from "../modules/restaurant/mock-restaurant.service";
import { RestaurantController } from "../modules/restaurant/restaurant.controller";
import { UserController } from "../modules/user/user.controller";

@Module({
  controllers: [AdminController, AuthController, RestaurantController, UserController],
  providers: [MockAuthService, MockRestaurantService]
})
export class AppModule {}
