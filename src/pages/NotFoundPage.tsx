import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Misc';

export function NotFoundPage() {
  return (
    <div className="card mx-auto max-w-xl">
      <EmptyState
        icon={<Compass className="size-7" />}
        title="This page does not exist"
        description="The route you asked for is not part of the app yet. Feature modules are added once the specification is confirmed."
        action={
          <Link to="/">
            <Button size="sm">Back to overview</Button>
          </Link>
        }
      />
    </div>
  );
}
