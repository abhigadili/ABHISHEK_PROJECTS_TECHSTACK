import { Box, Card, IconButton, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { memo, useLayoutEffect, useRef } from 'react';
import { ProfilePicture } from '@/components/common/ProfilePicture';
import type { OrgNode } from '@/types/api';

interface NodeProps {
  node: OrgNode;
  expanded: Set<number>;
  selectedId: number | null;
  highlightIds: Set<number>;
  onToggle: (id: number) => void;
  onSelect: (id: number) => void;
}

/**
 * One org-chart node (recursive). `memo` + stable callbacks from the parent mean toggling one branch re-renders only that
 * branch. Children are rendered ONLY when expanded, so a 10 000-person company costs what is visible, not what exists.
 */
const OrgTreeNode = memo(function OrgTreeNode({
  node,
  expanded,
  selectedId,
  highlightIds,
  onToggle,
  onSelect,
}: NodeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isSelected = selectedId === node.id;
  const open = expanded.has(node.id);
  const hasChildren = node.subordinates.length > 0;

  // useLayoutEffect = measure/scroll BEFORE the browser paints, so the selected card never visibly "jumps" into view afterwards
  useLayoutEffect(() => {
    if (isSelected) ref.current?.scrollIntoView?.({ block: 'nearest', inline: 'center', behavior: 'auto' });
  }, [isSelected]);

  return (
    <li>
      <Card
        ref={ref}
        className="org-node"
        sx={{
          p: 1,
          borderColor: isSelected ? 'primary.main' : highlightIds.has(node.id) ? 'warning.main' : undefined,
          borderWidth: isSelected || highlightIds.has(node.id) ? 2 : 1,
          bgcolor: isSelected ? 'action.selected' : undefined,
        }}
        data-testid={`org-node-${node.id}`}
        aria-current={isSelected ? 'true' : undefined}
      >
        <Box
          onClick={() => onSelect(node.id)}
          sx={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}
        >
          <ProfilePicture
            employeeId={node.id}
            name={node.name}
            hasPicture={!!node.profilePictureUrl}
            size={40}
          />
          <Typography variant="body2" fontWeight={700} noWrap sx={{ maxWidth: '100%' }}>
            {node.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: '100%' }}>
            {node.jobTitle ?? node.designation ?? '—'}
          </Typography>
          {node.department && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: '100%' }}>
              {node.department.name}
            </Typography>
          )}
        </Box>
        {hasChildren && (
          <IconButton
            size="small"
            onClick={() => onToggle(node.id)}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${node.name} (${node.directReportCount} reports)`}
            aria-expanded={open}
          >
            {open ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
            <Typography variant="caption">{node.directReportCount}</Typography>
          </IconButton>
        )}
      </Card>
      {hasChildren && open && (
        <ul>
          {node.subordinates.map((c) => (
            // key = stable employee id (never the array index): reordering/filtering keeps each card's state with the right person
            <OrgTreeNode
              key={c.id}
              node={c}
              expanded={expanded}
              selectedId={selectedId}
              highlightIds={highlightIds}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
});

export function OrgTree({ roots, ...rest }: Omit<NodeProps, 'node'> & { roots: OrgNode[] }) {
  return (
    <div className="org-tree" data-testid="org-tree">
      <ul>
        {roots.map((r) => (
          <OrgTreeNode key={r.id} node={r} {...rest} />
        ))}
      </ul>
    </div>
  );
}
