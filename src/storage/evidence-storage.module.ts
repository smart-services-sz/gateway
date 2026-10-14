import { Module } from '@nestjs/common';
import { EvidenceStorageService } from '../reclamos/evidence-storage.service';

@Module({
  providers: [EvidenceStorageService],
  exports: [EvidenceStorageService],
})
export class EvidenceStorageModule {}