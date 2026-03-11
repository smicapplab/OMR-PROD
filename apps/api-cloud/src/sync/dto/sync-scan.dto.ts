import { IsString, IsNotEmpty, IsNumber, IsBoolean, IsObject, IsOptional, IsUUID } from 'class-validator';

export class SyncScanDto {
  @IsString()
  @IsNotEmpty()
  machine_id!: string;

  @IsString()
  @IsNotEmpty()
  original_sha!: string;

  @IsNumber()
  confidence!: number;

  @IsBoolean()
  review_required!: boolean;

  @IsObject()
  raw_data!: any;

  @IsString()
  @IsOptional()
  school_id?: string;

  @IsString()
  @IsOptional()
  file_name?: string;

  @IsString()
  @IsOptional()
  file_url?: string;

  @IsString()
  @IsOptional()
  proxy_url?: string;
}
