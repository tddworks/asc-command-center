import { Report } from '../Report.ts';

export function mockReports(): Report[] {
  return [
    new Report(
      'r-1',
      'Sales Report',
      'Download daily, weekly, monthly, or yearly sales and trends data.',
      'asc sales-reports download --report-type SALES --frequency DAILY',
      'sales',
    ),
    new Report(
      'r-2',
      'Finance Report',
      'Download financial reports including earnings and payments.',
      'asc finance-reports download --report-type FINANCIAL',
      'finance',
    ),
    new Report(
      'r-3',
      'App Analytics',
      'View app impressions, downloads, and engagement metrics.',
      'asc analytics-reports list',
      'analytics',
    ),
    new Report(
      'r-4',
      'Launch Time',
      'Measure app launch performance across device types and OS versions.',
      'asc perf-metrics list --metric-type LAUNCH_TIME',
      'performance',
    ),
    new Report(
      'r-5',
      'Hang Rate',
      'Track main-thread hang rates and identify performance regressions.',
      'asc perf-metrics list --metric-type HANG_RATE',
      'performance',
    ),
    new Report(
      'r-6',
      'Subscriber Report',
      'Download subscription events and retention data.',
      'asc sales-reports download --report-type SUBSCRIBER',
      'sales',
    ),
  ];
}
