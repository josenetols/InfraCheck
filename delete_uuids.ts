import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { pool } from './src/lib/db.js';

async function run() {
  const locs = await pool.query(`
    SELECT name FROM locations 
    WHERE name NOT IN (
      'Volkswagen T7', 'Toyota T7', 'RAM Castelo Branco', 'Marketing Galpão',
      'Compliance', 'Primeira Mão T7', 'Primeira Mão Off Road T7', 'BYD Marista',
      'Tudo Chevrolet Mutirão', 'Nissan 85', 'Primeira Mão 85', 'BMW Carros',
      'CRT', 'Jeep / RAM BR', 'Triumph', 'BMW Motos', 'Seminovos Motos',
      'Tudo Chevrolet Buriti', 'Toyota Buriti', 'Primeira Mão Buriti', 'Hyundai T9',
      'Jeep T9', 'BYD Cidade Jardim', 'Hyundai Cidade Jardim', 'Primeira Mão Cidade Jardim',
      'Outlet Shopping', 'Primeira Mão Shopping', 'Toyota Anapolis', 'Hyundai Anapolis',
      'Primeira Mão Anapolis', 'Jeep / RAM Anapolis', 'Nissan Anapolis', 'Fazendinha',
      'Primeira Mão Galpão', 'Primeira Mão Digital Galpão', 'Corretora', 'Seguros',
      'CSC', 'DP', 'Contabilidade', 'Controladoria', 'Administrativo',
      'Diretoria', 'Auditoria Galpão', 'Compras Galpão', 'RH Galpão', 'Compras CRT',
      'CRT Galpão', 'Marketing BYD', 'CRM T.I', 'Compliance Galpão',
      'F&I', 'Galpão Autotech', 'SAGA BYD CIDADE JARDIM  - GOIANIA GO', 'Consorcio',
      'Saga Brasil Matriz', 'SAGA BYD Brasília  - BRASÍLIA', 'SAGA BYD Taguatinga  - BRASÍLIA',
      'SAGA BYD Lago Sul  - BRASÍLIA', 'SAGA BYD PORTO VELHO - RONDONIA', 'SAGA BYD CUIABA - MATO GROSSO',
      'ACDELCO - CBA - MT', 'SAGA BYD SINOP - MATO GROSSO', 'SAGA BMW MOTORRAD - GOIANIA GO',
      'PRIMEIRA MÃO MOTOS - GOIANIA GO', 'SAGA KTM GYN', 'SAGA BMW/MINI - GOIANIA GO',
      'SAGA BYD MARISTA - GOIANIA GO', 'SAGA TUDO GM MUTIRÃO - GOIANIA GO', 'SAGA GRAMARCA GM VÁRZEA GRANDE - MT',
      'SAGA GRAMARCA GM CUIABÁ- MT', 'SAGA GRAMARCA GM CACERES- MT', 'AUTOMINAS CITROEN - UBERLANDIA MG',
      'SAGA CRT - GOIANIA GO', 'SAGA CRT - BRASILIA DF', 'SAGA CRT - MATO GROSSO MT',
      'ESTAÇÃO FIAT COLORADO - DF', 'ESTAÇÃO FIAT GAMA- DF', 'ESTAÇÃO FIAT PARK SUL- DF',
      'ESTAÇÃO FIAT SIA- DF', 'SAGA HYUNDAI SIA - DF', 'SAGA HYUNDAI TAGUATINGA - DF',
      'SAGA HYUNDAI GOIANIA T9 - GO', 'SAGA HYUNDAI CIDADE JARDIM - GO', 'SAGA HYUNDAI ANÁPOLIS - GO',
      'SAGA HYUNDAI CUIABÁ - MT', 'SAGA HYUNDAI PORTO VELHO - RO', 'SAGA JEEP TAGUATINGA - DF',
      'SAGA JEEP ASA NORTE - DF', 'SAGA JEEP COLORADO - DF', 'SAGA JEEP T9 GOIANIA - GO',
      'SAGA JEEP BR153 GOIANIA - GO', 'SAGA JEEP ANÁPOLIS - GO', 'SAGA JEEP UBERLANDIA - MG',
      'SAGA LONDON CUIABA - MT', 'SAGA TAURO CUIABA - MT', 'SAGA NISSAN COLORADO - DF',
      'SAGA NISSAN TAGUATINGA - DF', 'SAGA SEMINOVOS AFONSO PENA', 'SAGA BYD RONDONÓPOLIS  - MATO GROSSO',
      'SAGA TUDO GM BURITI - APARECIDA GO', 'SAGA NISSAN VÁRZEA GRANDE - MT', 'SAGA NISSAN TANGARÁ - MT',
      'SAGA RAM BR153 GOIANIA - GO', 'SAGA RAM ANÁPOLIS - GO', 'SAGA RAM HOUSE - GO',
      'ESTAÇÃO RENAULT CUIABÁ - MT', 'ESTAÇÃO RENAULT VÁRZEA GRANDE- MT', 'SAGA LEMANS RENAULT PORTO VELHO - RO',
      'SAGA MOOVE - SÃO PAULO', 'SAGA TOYOTA ASA NORTE', 'SAGA NISSAN CUIABÁ - MT',
      'SAGA TOYOTA COLORADO', 'SAGA TOYOTA GOIANIA - GO', 'SAGA TOYOTA ANAPOLIS - GO',
      'SAGA TOYOTA  BURITI - APARECIDA - GO', 'SAGA TRIUMPH BR153 GOIANIA - GO', 'SAGA VOLKSWAGEN T7 GOIANIA - GO',
      'SAGA AUTOMINAS VW UBERLANDIA - MG', 'SAGA VOLKSWAGEN EPIA SUL - DF', 'SAGA VOLKSWAGEN GAMA - DF',
      'SAGA AMAZÔNIA VW PORTO VELHO - RO', 'SAGA SN DF CONTAINER', 'SAGA SN DF GAMA',
      'SAGA SN COLORADO', 'SAGA SN DF TAGUATINGA', 'SAGA SN SADIF', 'SAGA SN PARK SUL',
      'SAGA SN ASA NORTE', 'SAGA SN DF SCIA', 'SAGA SN OUTLET CEILÂNDIA',
      'SAGA SN ATACADO (OUTLET SIA)', 'SAGA SN TOYOTA OFF ROAD T7', 'SAGA SN AV85',
      'SAGA SN GO T7', 'SAGA SN BURITI', 'SAGA SN CIDADE JARDIM', 'SAGA SN GALPÃO',
      'SAGA SN OUTLET', 'SAGA SN REPASSE', 'SAGA SN DIGITAL - RO', 'SAGA NISSAN AV85 GOIANIA - GO',
      'SAGA DENZA LAGO SUL - BRASILIA', 'SAGA LEAP UBERLANDIA - MG', 'SAGA FRANCE  UBERLANDIA - MG',
      'SAGA UBERLÂNDIA', 'SAGA SN ESTAÇAO RENAULT CBA', 'SAGA NISSAN 85'
    )
  `);

  const names = locs.rows.map(r => r.name);
  console.log("Achou", names.length, "lojas suspeitas (provavelmente UUIDs)");

  if (names.length > 0) {
    await pool.query(`DELETE FROM assignments WHERE location_name = ANY($1::text[])`, [names]);
    await pool.query(`DELETE FROM checklists WHERE location_name = ANY($1::text[])`, [names]);
    const res = await pool.query(`DELETE FROM locations WHERE name = ANY($1::text[])`, [names]);
    console.log("Deletadas:", res.rowCount);
  }
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
