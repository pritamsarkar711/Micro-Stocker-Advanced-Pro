import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Misc';

export function NotFoundPage() {
  return (
    <div className="card mx-auto max-w-xl">
      <EmptyState
        icon={<Compass className="size-7" />}
        title="Not found"
        
        action={
          <Link to="/">
            <Button size="sm">Overview</Button>
          </Link>
        }
      />
    </div>
  );
}
