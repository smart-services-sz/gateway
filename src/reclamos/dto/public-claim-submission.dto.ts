import {
  IsIn,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export const PUBLIC_CLAIM_CATEGORIES = [
  'agua_y_cloacas', 'alumbrado', 'baches_y_pavimento', 'arbolado', 'residuos',
  'electricidad', 'gas', 'transporte', 'infraestructura', 'otros',
];

export class PublicClaimSubmissionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  problema!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  direccion!: string;

  @IsString()
  @IsIn(PUBLIC_CLAIM_CATEGORIES)
  categoria!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  @Matches(
    /^(?:[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?=(?:\D*\d){8,15}\D*$)\+?[\d\s().-]{8,25})$/i,
    { message: 'contacto debe ser un correo o telefono valido' },
  )
  contacto!: string;
}