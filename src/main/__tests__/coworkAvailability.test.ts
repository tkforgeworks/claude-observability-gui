/**
 * Cowork availability derivation (CGUI-81).
 *
 * The pure matrix: platform × override × historical data. 'live' whenever
 * collection is possible in principle (supported platform or override),
 * 'historical' when only stored data exists, 'none' otherwise — and
 * `available` is false only for 'none'.
 */

jest.mock('../config/configStore', () => ({
  loadSettings: jest.fn(),
}));
jest.mock('../db/queries', () => ({
  queryHasCoworkData: jest.fn(),
}));

import { loadSettings } from '../config/configStore';
import { queryHasCoworkData } from '../db/queries';
import { deriveCoworkAvailability, getCoworkAvailability } from '../services/coworkAvailability';

const mockLoadSettings = loadSettings as jest.Mock;
const mockHasData = queryHasCoworkData as jest.Mock;

const realPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;

function setPlatform(platform: NodeJS.Platform): void {
  Object.defineProperty(process, 'platform', { value: platform });
}

afterEach(() => {
  Object.defineProperty(process, 'platform', realPlatform);
  jest.clearAllMocks();
});

describe('deriveCoworkAvailability matrix', () => {
  const cases: Array<{
    platformSupported: boolean;
    overrideActive: boolean;
    hasHistoricalData: boolean;
    mode: 'live' | 'historical' | 'none';
  }> = [
    // Supported platform is 'live' regardless of override or data
    { platformSupported: true, overrideActive: false, hasHistoricalData: false, mode: 'live' },
    { platformSupported: true, overrideActive: false, hasHistoricalData: true, mode: 'live' },
    { platformSupported: true, overrideActive: true, hasHistoricalData: false, mode: 'live' },
    { platformSupported: true, overrideActive: true, hasHistoricalData: true, mode: 'live' },
    // Unsupported platform with the override escape hatch is still 'live'
    { platformSupported: false, overrideActive: true, hasHistoricalData: false, mode: 'live' },
    { platformSupported: false, overrideActive: true, hasHistoricalData: true, mode: 'live' },
    // Unsupported platform, no override: data decides historical vs none
    { platformSupported: false, overrideActive: false, hasHistoricalData: true, mode: 'historical' },
    { platformSupported: false, overrideActive: false, hasHistoricalData: false, mode: 'none' },
  ];

  it.each(cases)(
    'platform=$platformSupported override=$overrideActive data=$hasHistoricalData → $mode',
    ({ mode, ...inputs }) => {
      expect(deriveCoworkAvailability(inputs)).toEqual({
        available: mode !== 'none',
        mode,
        ...inputs,
      });
    }
  );
});

describe('getCoworkAvailability input gathering', () => {
  const fakeDb = {} as never;

  it('reads win32 as platform-supported', () => {
    setPlatform('win32');
    mockLoadSettings.mockReturnValue({ logFilePath: null });
    mockHasData.mockReturnValue(false);

    expect(getCoworkAvailability(fakeDb)).toMatchObject({
      mode: 'live',
      platformSupported: true,
      overrideActive: false,
    });
  });

  it('treats a set logFilePath as an active override on Linux', () => {
    setPlatform('linux');
    mockLoadSettings.mockReturnValue({ logFilePath: '/var/log/claude/main.log' });
    mockHasData.mockReturnValue(false);

    expect(getCoworkAvailability(fakeDb)).toMatchObject({
      mode: 'live',
      platformSupported: false,
      overrideActive: true,
    });
  });

  it('reports historical mode on Linux when only imported data exists', () => {
    setPlatform('linux');
    mockLoadSettings.mockReturnValue({ logFilePath: null });
    mockHasData.mockReturnValue(true);

    expect(getCoworkAvailability(fakeDb)).toEqual({
      available: true,
      mode: 'historical',
      platformSupported: false,
      overrideActive: false,
      hasHistoricalData: true,
    });
  });

  it('reports none on Linux with no override and an empty database', () => {
    setPlatform('linux');
    mockLoadSettings.mockReturnValue({ logFilePath: null });
    mockHasData.mockReturnValue(false);

    expect(getCoworkAvailability(fakeDb)).toEqual({
      available: false,
      mode: 'none',
      platformSupported: false,
      overrideActive: false,
      hasHistoricalData: false,
    });
  });
});
