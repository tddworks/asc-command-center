import { Simulator } from '../Simulator.ts';

export function mockSimulators(): Simulator[] {
  return [
    new Simulator('A1B2C3D4-E5F6-7890-ABCD-EF1234567890', 'iPhone 17 Pro Max', 'Booted', 'com.apple.CoreSimulator.SimRuntime.iOS-26-4', 'iOS 26.4', { stream: 'asc simulators stream --udid A1B2C3D4-E5F6-7890-ABCD-EF1234567890', listSimulators: 'asc simulators list', shutdown: 'asc simulators shutdown --udid A1B2C3D4-E5F6-7890-ABCD-EF1234567890' }),
    new Simulator('B2C3D4E5-F6A7-8901-BCDE-F12345678901', 'iPhone 17', 'Shutdown', 'com.apple.CoreSimulator.SimRuntime.iOS-26-4', 'iOS 26.4', { boot: 'asc simulators boot --udid B2C3D4E5-F6A7-8901-BCDE-F12345678901', listSimulators: 'asc simulators list' }),
    new Simulator('C3D4E5F6-A7B8-9012-CDEF-123456789012', 'iPhone 17 Pro', 'Shutdown', 'com.apple.CoreSimulator.SimRuntime.iOS-26-4', 'iOS 26.4', { boot: 'asc simulators boot --udid C3D4E5F6-A7B8-9012-CDEF-123456789012', listSimulators: 'asc simulators list' }),
    new Simulator('D4E5F6A7-B8C9-0123-DEFA-234567890123', 'iPhone 17e', 'Shutdown', 'com.apple.CoreSimulator.SimRuntime.iOS-26-4', 'iOS 26.4', { boot: 'asc simulators boot --udid D4E5F6A7-B8C9-0123-DEFA-234567890123', listSimulators: 'asc simulators list' }),
    new Simulator('E5F6A7B8-C9D0-1234-EFAB-345678901234', 'iPad Air 11-inch (M4)', 'Shutdown', 'com.apple.CoreSimulator.SimRuntime.iOS-26-4', 'iOS 26.4', { boot: 'asc simulators boot --udid E5F6A7B8-C9D0-1234-EFAB-345678901234', listSimulators: 'asc simulators list' }),
  ];
}
