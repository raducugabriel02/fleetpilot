export function routeLabel(trip: { originAddress: string; destAddress: string }): string {
  return `${trip.originAddress} → ${trip.destAddress}`;
}
