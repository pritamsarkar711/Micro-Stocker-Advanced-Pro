
import { Card } from '@/components/ui/Card';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Misc';
import { GIcon } from '@/components/ui/GoogleIcon';

export function NotFoundPage() {
  return (
    <Card className="mx-auto max-w-lg">
      <EmptyState
        icon={<GIcon name="explore" size={28} />}
        title="Page not found"
        action={
          <ButtonLink to="/" size="sm" variant="primary" icon={<GIcon name="home" size={15} />}>
            Overview
          </ButtonLink>
        }
      />
    </Card>
  );
}
