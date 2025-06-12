'use client'

const cn = (...classes: (string | undefined)[]) => {
  return classes.filter(Boolean).join(' ')
}

const statuses = [
    {
        label: 'Online',
        color: 'text-green-400',
        bgColor: 'bg-green-400',
        status: 'online'
    },
    {
        label: 'Offline',
        color: 'text-red-600',
        bgColor: 'bg-red-600',
        status: 'offline'
    },
    {
        label: 'Connecting',
        color: 'text-orange-400',
        bgColor: 'bg-orange-400',
        status: 'connecting'
    }
]

interface StatusProps {
    currentStatus?: number
    className?: string
}

const Status = ({ currentStatus = 0, className }: StatusProps) => {
  const status = statuses[currentStatus]
  
  return (
    <div 
      data-status={status.status} 
      className={cn("w-11 h-4 relative", className)}
    >
      <div className={cn(
        "absolute left-2.5 top-0 text-xs font-normal font-inter",
        status.color
      )}>
        {status.label}
      </div>
      <div className={cn(
        "w-2 h-2 absolute left-0 top-1.5 rounded-full",
        status.bgColor
      )} />
    </div>
  )
}

export default Status