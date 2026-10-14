import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class PublicTrackingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  @Matches(/^REC-[A-Z0-9]+$/i, { message: 'codigo de seguimiento no valido' })
  codigoSeguimiento!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  @Matches(
    /^(?:[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?=(?:\D*\d){8,15}\D*$)\+?[\d\s().-]{8,25})$/i,
    { message: 'contacto debe ser un correo o telefono valido' },
  )
  contacto!: string;
}