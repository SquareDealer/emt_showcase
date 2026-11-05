import type { GenerationSpec } from '../types';

/** Mirrors migration 1719100000000 (AddVehicleMakeAndGenerations), in the same order. */
export const MINI_GENERATIONS: GenerationSpec[] = [
  { code: 'R50', model: 'Hatch', years: '2001–2006' },
  { code: 'R53', model: 'Hatch', years: '2002–2006' },
  { code: 'R52', model: 'Cabrio', years: '2004–2008' },
  { code: 'R56', model: 'Hatch', years: '2006–2013' },
  { code: 'R55', model: 'Clubman', years: '2007–2014' },
  { code: 'R57', model: 'Cabrio', years: '2008–2015' },
  { code: 'R60', model: 'Countryman', years: '2010–2016' },
  { code: 'R58', model: 'Coupe', years: '2011–2015' },
  { code: 'R59', model: 'Roadster', years: '2012–2015' },
  { code: 'R61', model: 'Paceman', years: '2012–2016' },
  { code: 'F56', model: 'Hatch', years: '2013–2024' },
  { code: 'F55', model: 'Hatch 5D', years: '2014–2024' },
  { code: 'F54', model: 'Clubman', years: '2015–2024' },
  { code: 'F57', model: 'Cabrio', years: '2015–2024' },
  { code: 'F60', model: 'Countryman', years: '2017–2024' },
  { code: 'J01', model: 'Cooper SE', years: '2024–' },
  { code: 'U25', model: 'Countryman', years: '2024–' },
  { code: 'F66', model: 'Cooper', years: '2024–' },
  { code: 'F65', model: 'Cooper 5D', years: '2024–' },
];
