import { Controller, Get, Post, Param, Body, UnauthorizedException, Headers, Req, Query } from '@nestjs/common';
import { SyncScanDto } from './dto/sync-scan.dto';
import { SyncLogsDto } from './dto/sync-logs.dto';
import { AuthService } from '../auth/auth.service';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
    constructor(
        private readonly authService: AuthService,
        private readonly syncService: SyncService,
    ) { }

    @Post('register')
    async registerMachine(@Body() body: { machineId: string }) {
        return this.syncService.registerMachine(body);
    }

    @Post('scans')
    async syncScanResult(
        @Body() body: SyncScanDto,
        @Headers('x-machine-secret') machineSecret: string
    ) {
        return this.syncService.syncScanResult(body, machineSecret);
    }

    @Post('logs')
    async syncActivityLogs(
        @Body() body: SyncLogsDto,
        @Headers('x-machine-secret') machineSecret: string
    ) {
        return this.syncService.syncActivityLogs(body, machineSecret);
    }

    @Get('stats')
    async getGlobalStats(@Req() req: any) {
        const authHeader = req.headers.authorization;
        if (!authHeader) throw new UnauthorizedException();
        const user = await this.authService.verifyToken(authHeader.split(' ')[1]);
        if (!user) throw new UnauthorizedException();

        return this.syncService.getGlobalStats(user);
    }

    @Get('scans/:id')
    async getScan(@Param('id') id: string, @Req() req: any) {
        const user = await this.authService.verifyToken(req.headers.authorization?.split(' ')[1]);
        if (!user) throw new UnauthorizedException();

        return this.syncService.getScan(id, user);
    }

    @Get('errored-sheets')
    async listErroredScans(
        @Query('limit') limit: string = '20',
        @Query('offset') offset: string = '0',
        @Query('reviewStatus') reviewStatus: string = 'pending',
        @Query('search') search: string = '',
        @Req() req: any
    ) {
        const user = await this.authService.verifyToken(req.headers.authorization?.split(' ')[1]);
        if (!user) throw new UnauthorizedException();

        return this.syncService.listErroredScans(limit, offset, reviewStatus, search, user);
    }

    @Post('errored-sheets/:id/mark-invalid')
    async markInvalid(@Param('id') id: string, @Body() body: { notes?: string }, @Req() req: any) {
        const user = await this.authService.verifyToken(req.headers.authorization?.split(' ')[1]);
        if (!user || user.userType !== 'SUPER_ADMIN') {
            throw new UnauthorizedException('Insufficient permissions');
        }

        return this.syncService.markInvalid(id, body.notes || '', user.id);
    }

    @Post('errored-sheets/:id/bubble-correction')
    async bubbleCorrection(@Param('id') id: string, @Body() body: { raw_data: any, reason?: string, version?: string }, @Req() req: any) {
        const user = await this.authService.verifyToken(req.headers.authorization?.split(' ')[1]);
        if (!user || user.userType !== 'SUPER_ADMIN') {
            throw new UnauthorizedException('Insufficient permissions');
        }

        return this.syncService.bubbleCorrection(id, body.raw_data, body.reason || '', body.version || '', user.id);
    }

    @Get('scans')
    async listScans(
        @Query('limit') limit: string = '20',
        @Query('offset') offset: string = '0',
        @Query('search') search: string = '',
        @Query('schoolId') schoolId: string = '',
        @Query('regionId') regionId: string = '',
        @Req() req: any
    ) {
        const user = await this.authService.verifyToken(req.headers.authorization?.split(' ')[1]);
        if (!user) throw new UnauthorizedException();

        return this.syncService.listScans(limit, offset, search, schoolId, regionId, user);
    }

    @Get('machines/:machineId/resolutions')
    async getMachineResolutions(
        @Param('machineId') machineId: string,
        @Headers('x-machine-secret') machineSecret: string
    ) {
        await this.syncService.validateMachine(machineId, machineSecret);
        return this.syncService.getMachineResolutions(machineId);
    }

    @Get('machines/:machineId/operators')
    async getMachineOperators(
        @Param('machineId') machineId: string,
        @Headers('x-machine-secret') machineSecret: string
    ) {
        const machine = await this.syncService.validateMachine(machineId, machineSecret);
        return this.syncService.getMachineOperators(machine.id);
    }

    @Get('machines/:machineId/schools')
    async getMachineSchools(
        @Param('machineId') machineId: string,
        @Headers('x-machine-secret') machineSecret: string
    ) {
        const machine = await this.syncService.validateMachine(machineId, machineSecret);
        return this.syncService.getMachineSchools(machine.id);
    }
}
