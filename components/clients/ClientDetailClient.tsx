'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ClientDetail from './ClientDetail'
import ClientFormDrawer from './ClientFormDrawer'
import type { Client, Tag } from '@/types/database'

interface Props {
  client: Client
  tags: Tag[]
}

export default function ClientDetailClient({ client, tags }: Props) {
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const clientWithTags = { ...client, tags }

  return (
    <>
      <ClientDetail
        client={clientWithTags}
        onEdit={() => setDrawerOpen(true)}
      />
      <ClientFormDrawer
        open={drawerOpen}
        mode="edit"
        client={clientWithTags}
        allTags={tags}
        onClose={() => setDrawerOpen(false)}
        onSuccess={() => {
          setDrawerOpen(false)
          router.refresh()
        }}
      />
    </>
  )
}
