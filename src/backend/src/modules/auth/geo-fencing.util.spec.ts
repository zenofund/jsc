import { evaluateGeoFencingPolicy } from './geo-fencing.util';

describe('evaluateGeoFencingPolicy', () => {
  it('allows access when geo fencing is disabled', () => {
    const result = evaluateGeoFencingPolicy({
      settings: { geo_fencing_enabled: false },
      requestHeaders: {},
      remoteIp: '8.8.8.8',
    });

    expect(result.allowed).toBe(true);
  });

  it('denies access when the supplied location is outside the configured radius', () => {
    const result = evaluateGeoFencingPolicy({
      settings: {
        geo_fencing_enabled: true,
        office_latitude: 5.55,
        office_longitude: -0.2,
        office_radius_meters: 200,
      },
      requestHeaders: {
        'x-location-latitude': '5.551',
        'x-location-longitude': '-0.21',
      },
      remoteIp: '8.8.8.8',
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('within the office perimeter');
  });
});
