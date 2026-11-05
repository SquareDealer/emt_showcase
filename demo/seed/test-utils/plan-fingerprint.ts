// Run in a child process with its own TZ: prints the host offset (proof the zone took effect)
// and a hash of the plan built for `--now` = argv[2].
import { createHash } from 'crypto';
import { buildDemoPlan } from '../plan';
import { mskAt } from '../time';

const day = process.argv[2];
const json = JSON.stringify(buildDemoPlan(mskAt(day, 12)));
process.stdout.write(
  JSON.stringify({
    offset: new Date(Date.UTC(2026, 10, 4, 12)).getTimezoneOffset(),
    hash: createHash('sha256').update(json).digest('hex'),
  }),
);
