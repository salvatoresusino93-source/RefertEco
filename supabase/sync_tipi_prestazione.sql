-- Sincronizza i tipi di prestazione dell'Agenda con quelli di RefertEco
-- Eseguire nel SQL Editor di Supabase

-- 1. Aggiungi vincolo UNIQUE su nome (se non esiste)
ALTER TABLE tipi_prestazione ADD CONSTRAINT tipi_prestazione_nome_unique UNIQUE (nome);

-- 2. Inserisci tutti i tipi da RefertEco (salta i duplicati)
INSERT INTO tipi_prestazione (nome, durata_minuti, codice_dicom) VALUES

-- ADDOME
('Ecografia addome superiore',                    20, 'US_ADD_SUP'),
('Ecografia addome inferiore',                    20, 'US_ADD_INF'),
('Ecografia addome completo',                     30, 'US_ADDOME'),
('Ecografia epatica',                             20, 'US_FEGATO'),
('Ecografia epato-biliare',                       20, 'US_EPATO_BIL'),
('Ecografia colecisti e vie biliari',              20, 'US_COLECISTI'),
('Ecografia pancreatica',                         20, 'US_PANCREAS'),
('Ecografia splenica',                            15, 'US_MILZA'),
('Ecografia delle anse intestinali',              20, 'US_INTESTINO'),
('Ecografia della parete addominale',             15, 'US_PARETE_ADD'),
('Eco-CEUS epatica',                              30, 'CEUS_FEGATO'),

-- APPARATO URINARIO
('Ecografia apparato urinario',                   20, 'US_APP_URINARIO'),
('Ecografia renale',                              20, 'US_RENE'),
('Ecografia vescicale',                           15, 'US_VESCICA'),
('Ecografia vescico-prostatica sovrapubica',      20, 'US_VES_PROS'),
('Ecografia prostatica transrettale',             20, 'US_PROS_TR'),
('Ecografia surrenalica',                         15, 'US_SURRENE'),

-- COLLO E TIROIDE
('Ecografia tiroide',                             20, 'US_TIROIDE'),
('Ecografia tiroide e paratiroidi',               20, 'US_TIROIDE_PT'),
('Ecografia del collo',                           20, 'US_COLLO'),
('Ecografia linfonodale laterocervicale',         20, 'US_LINFONODI_CERV'),
('Ecografia ghiandole salivari',                  15, 'US_SALIVARI'),
('Ecografia parotide',                            15, 'US_PAROTIDE'),

-- GINECOLOGIA E OSTETRICIA
('Ecografia ginecologica sovrapubica',            20, 'US_GIN_SV'),
('Ecografia ginecologica transvaginale',          20, 'US_GIN_TV'),
('Ecografia pelvica',                             20, 'US_PELVI'),
('Ecografia ostetrica I trimestre',               20, 'US_GEST_1T'),
('Ecografia ostetrica morfologica (II trimestre)',30, 'US_GEST_2T'),
('Ecografia ostetrica di accrescimento (III trimestre)', 20, 'US_GEST_3T'),
('Ecografia ostetrica con translucenza nucale',   30, 'US_NUCALE'),
('Ecocardiografia fetale',                        40, 'US_ECOFETALE'),

-- UROLOGIA
('Ecografia scrotale',                            15, 'US_SCROTO'),
('Ecografia testicolare',                         15, 'US_TESTICOLO'),
('Ecocolordoppler scrotale',                      20, 'DOPPLER_SCROTO'),

-- MAMMELLA
('Ecografia mammaria monolaterale',               20, 'US_MAMMELLA_MONO'),
('Ecografia mammaria bilaterale',                 30, 'US_MAMMELLA_BI'),
('Ecografia mammaria con studio ascellare',       30, 'US_MAMMELLA_ASCELL'),

-- MUSCOLO-SCHELETRICO
('Ecografia muscolo-scheletrica',                 20, 'US_MSK'),
('Ecografia muscolo-tendinea',                    20, 'US_MUSC_TEND'),
('Ecografia parti molli',                         20, 'US_PARTI_MOLLI'),
('Ecografia spalla',                              20, 'US_SPALLA'),
('Ecografia gomito',                              20, 'US_GOMITO'),
('Ecografia polso e mano',                        20, 'US_POLSO'),
('Ecografia anca',                                20, 'US_ANCA'),
('Ecografia ginocchio',                           20, 'US_GINOCCHIO'),
('Ecografia caviglia e piede',                    20, 'US_CAVIGLIA'),
('Ecografia anca neonatale',                      20, 'US_ANCA_NEO'),
('Ecografia inguinale',                           15, 'US_INGUINE'),
('Ecografia cute e sottocute',                    15, 'US_CUTE'),

-- ECOCOLORDOPPLER VASCOLARE
('Ecocolordoppler TSA (tronchi sovraortici)',      30, 'DOPPLER_TSA'),
('Ecocolordoppler aorta addominale',              20, 'DOPPLER_AORTA'),
('Ecocolordoppler arterioso arti inferiori',      30, 'DOPPLER_ART_AAII'),
('Ecocolordoppler venoso arti inferiori',         30, 'DOPPLER_VEN_AAII'),
('Ecocolordoppler arterioso arti superiori',      30, 'DOPPLER_ART_AASS'),
('Ecocolordoppler venoso arti superiori',         30, 'DOPPLER_VEN_AASS'),
('Ecocolordoppler arterie renali',                30, 'DOPPLER_RENALE'),
('Ecocolordoppler circolo portale',               20, 'DOPPLER_PORTALE'),
('Ecocolordoppler penieno',                       20, 'DOPPLER_PENIENO'),
('Ecocolordoppler transcranico',                  30, 'DOPPLER_TCD'),
('Ecocolordoppler vasi mesenterici',              20, 'DOPPLER_MESENT'),

-- ALTRO
('Ecografia torace e pleura',                     20, 'US_TORACE'),
('Ecografia polmonare (LUS)',                     20, 'US_POLMONE'),
('Ecografia linfonodi',                           20, 'US_LINFONODI'),
('Ecografia oculare',                             20, 'US_OCCHIO'),
('Ecografia al letto (POCUS)',                    15, 'POCUS'),
('Ecografia intraoperatoria',                     20, 'US_INTRAOP'),
('Ecografia interventistica (guida biopsia/drenaggio)', 30, 'US_INTERVENTISTICA')

ON CONFLICT (nome) DO UPDATE SET durata_minuti = EXCLUDED.durata_minuti, codice_dicom = EXCLUDED.codice_dicom;
