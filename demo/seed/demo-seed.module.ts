import { DynamicModule, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { entities, migrations } from '../../src/data-source';
import { CalendarBlocksModule } from '../../src/calendar-blocks/calendar-blocks.module';
import { ClientsModule } from '../../src/clients/clients.module';
import { PartTemplatesModule } from '../../src/part-templates/part-templates.module';
import { SettingsModule } from '../../src/settings/settings.module';
import { TaskTemplatesModule } from '../../src/task-templates/task-templates.module';
import { UsersModule } from '../../src/users/users.module';
import { VehicleGenerationsModule } from '../../src/vehicle-generations/vehicle-generations.module';
import { VehiclesModule } from '../../src/vehicles/vehicles.module';
import { WorkOrdersModule } from '../../src/work-orders/work-orders.module';

/**
 * The app's services without the HTTP app: no SeedModule (it would create owner/owner and its own
 * templates on bootstrap), no AuthModule, no ConfigModule. The URL is passed in explicitly, never
 * read from process.env, which dotenv may have filled from .env.
 */
@Module({})
export class DemoSeedModule {
  /** `migrationsRun: false` for verify: a reader must not migrate the database it checks. */
  static forUrl(url: string, opts: { migrationsRun?: boolean } = {}): DynamicModule {
    return {
      module: DemoSeedModule,
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          url,
          entities,
          migrations,
          migrationsRun: opts.migrationsRun ?? true,
          synchronize: false,
          logging: false,
        }),
        UsersModule,
        ClientsModule,
        VehiclesModule,
        VehicleGenerationsModule,
        WorkOrdersModule,
        CalendarBlocksModule,
        TaskTemplatesModule,
        PartTemplatesModule,
        SettingsModule,
      ],
    };
  }
}
