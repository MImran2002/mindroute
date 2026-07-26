import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import { environmentValidationSchema } from './config/env.validation';
import { HealthModule } from './modules/health/health.module';
import { LocationsModule } from './modules/locations/locations.module';
import { NavigationModule } from './modules/navigation/navigation.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [appConfig],
      validationSchema: environmentValidationSchema,
    }),
    HealthModule,
    LocationsModule,
    NavigationModule,
  ],
})
export class AppModule {}
