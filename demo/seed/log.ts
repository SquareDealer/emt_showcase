import { HERO, heroSchedule } from './hero';
import { mskDay, mskMinutes } from './time';

export interface ProgressLog {
  stage(name: string): void;
  progress(name: string, done: number, total: number): void;
  summary(counts: Record<string, number>, schedule: ReturnType<typeof heroSchedule>): void;
}

const MS_MIN = 60_000;

function mskStamp(d: Date): string {
  const m = mskMinutes(d);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${mskDay(d)} ${p(Math.floor(m / 60))}:${p(m % 60)}`;
}

export function createProgressLog(out: (line: string) => void = (l) => process.stdout.write(`${l}\n`)): ProgressLog {
  const started = Date.now();
  const elapsed = () => `${((Date.now() - started) / 1000).toFixed(1)}s`;
  return {
    stage(name) {
      out(`→ ${name} (${elapsed()})`);
    },
    progress(name, done, total) {
      out(`  ${name} ${done}/${total}`);
    },
    summary(counts, schedule) {
      const { startsAt, durationMin } = schedule.freeSlot;
      const width = Math.max(...Object.keys(counts).map((k) => k.length), 0);
      out(`Готово за ${elapsed()}.`);
      out('Записано:');
      for (const [k, v] of Object.entries(counts)) out(`  ${k.padEnd(width)}  ${v}`);
      out('HERO:');
      out(`  клиент          ${HERO.client.id}  ${HERO.client.name}, ${HERO.client.phone}`);
      out(`  R56             ${HERO.r56.vehicleId}  ${HERO.r56.plate}, VIN ${HERO.r56.vin}`);
      out(`  вторая машина   ${HERO.secondVehicleId}`);
      out(`  диагностика     ${HERO.diagnosticsOrderId}`);
      out(`  большой наряд   ${HERO.bigOrder.id}  (машина ${HERO.bigOrder.vehicleId}, клиент ${HERO.bigOrder.clientId})`);
      out(`  наряд для PDF   ${HERO.pdfOrderId}`);
      out(`  автопарк        ${HERO.fleetClientId}`);
      out(`  мастер          ${HERO.masterId}`);
      out(`  логины          ${HERO.logins.owner} / ${HERO.logins.receptionist} / ${HERO.logins.master}`);
      out(`  плотный день    ${schedule.busyDay}`);
      out(`  свободное окно  ${mskStamp(startsAt)}–${mskStamp(new Date(startsAt.getTime() + durationMin * MS_MIN)).slice(11)} MSK`);
    },
  };
}
