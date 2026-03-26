import { IsString, IsNotEmpty, IsArray } from 'class-validator';

export class SyncLogsDto {
    @IsString()
    @IsNotEmpty()
    machine_id!: string;

    @IsArray()
    logs!: any[];
}
