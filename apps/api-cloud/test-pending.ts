import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';
import { MaintenanceController } from './src/maintenance/maintenance.controller';

async function test() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const controller = app.get(MaintenanceController);
  
  // Create a mock Request object
  const mockReq = { 
    headers: { 
        authorization: 'Bearer MOCK_TOKEN' 
    } 
  };

  // We need to mock validateUser because we don't have a real token
  (controller as any).validateUser = async () => ({
    email: 'admin@omr-prod.gov.ph',
    userType: 'SUPER_ADMIN',
    visibilityScope: 'NATIONAL'
  });

  try {
    const results = await controller.listPendingReview(mockReq);
    console.log('--- TEST RESULTS ---');
    console.log('Count:', results.length);
    if (results.length > 0) {
        console.log('First Item ID:', results[0].id);
        console.log('Review Required:', results[0].reviewRequired);
    }
  } catch (err) {
    console.error('Test failed:', err);
  } finally {
    await app.close();
  }
}

test();
