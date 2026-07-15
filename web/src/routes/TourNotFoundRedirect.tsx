import { Navigate, useParams } from 'react-router-dom';
import { tourPath } from '@/lib/routing';

export function TourNotFoundRedirect() {
  const { tourId } = useParams<{ tourId: string }>();
  return <Navigate to={tourPath(tourId ?? '')} replace />;
}
