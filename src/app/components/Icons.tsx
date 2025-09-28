import { 
  Heart, 
  Bookmark, 
  MoreHorizontal, 
  Palette, 
  RefreshCw, 
  Sparkles,
  ArrowLeft,
  Paperclip,
  MessageCircle,
  Send,
  Image as ImageIcon,
  Plus,
  Check,
  Star,
  User,
  Search,
  Home,
  TrendingUp,
  TrendingDown,
  ArrowUp,
  Shuffle,
  ZoomIn,
  AlertCircle,
  Folder,
  Settings,
  AlertTriangle,
  BarChart,
  Eye,
  Lock,
  ShoppingBag,
  CheckCircle,
  Minus,
  X,
  Download,
  Share,
  ImageOff
} from 'lucide-react';

interface IconProps {
  className?: string;
  size?: number;
}

export const Icons = {
  // Actions
  Heart: ({ className, size = 18 }: IconProps) => <Heart className={className} size={size} />,
  Bookmark: ({ className, size = 18 }: IconProps) => <Bookmark className={className} size={size} />,
  More: ({ className, size = 18 }: IconProps) => <MoreHorizontal className={className} size={size} />,
  
  // Navigation
  ArrowLeft: ({ className, size = 18 }: IconProps) => <ArrowLeft className={className} size={size} />,
  
  // Creation
  Palette: ({ className, size = 18 }: IconProps) => <Palette className={className} size={size} />,
  Sparkles: ({ className, size = 18 }: IconProps) => <Sparkles className={className} size={size} />,
  Regenerate: ({ className, size = 18 }: IconProps) => <RefreshCw className={className} size={size} />,
  RefreshCw: ({ className, size = 18 }: IconProps) => <RefreshCw className={className} size={size} />,
  
  // Communication
  Attach: ({ className, size = 18 }: IconProps) => <Paperclip className={className} size={size} />,
  Message: ({ className, size = 18 }: IconProps) => <MessageCircle className={className} size={size} />,
  Send: ({ className, size = 18 }: IconProps) => <Send className={className} size={size} />,
  Image: ({ className, size = 18 }: IconProps) => <ImageIcon className={className} size={size} />,
  
  // Status
  Plus: ({ className, size = 18 }: IconProps) => <Plus className={className} size={size} />,
  Check: ({ className, size = 18 }: IconProps) => <Check className={className} size={size} />,
  Star: ({ className, size = 18 }: IconProps) => <Star className={className} size={size} />,
  User: ({ className, size = 18 }: IconProps) => <User className={className} size={size} />,
  Search: ({ className, size = 18 }: IconProps) => <Search className={className} size={size} />,
  
  // Navigation
  Home: ({ className, size = 18 }: IconProps) => <Home className={className} size={size} />,
  Trending: ({ className, size = 18 }: IconProps) => <TrendingUp className={className} size={size} />,
  TrendingUp: ({ className, size = 18 }: IconProps) => <TrendingUp className={className} size={size} />,
  TrendingDown: ({ className, size = 18 }: IconProps) => <TrendingDown className={className} size={size} />,
  Gallery: ({ className, size = 18 }: IconProps) => <Folder className={className} size={size} />,
  Folder: ({ className, size = 18 }: IconProps) => <Folder className={className} size={size} />,
  Settings: ({ className, size = 18 }: IconProps) => <Settings className={className} size={size} />,
  
  // Additional Icons
  ArrowUp: ({ className, size = 18 }: IconProps) => <ArrowUp className={className} size={size} />,
  Shuffle: ({ className, size = 18 }: IconProps) => <Shuffle className={className} size={size} />,
  ZoomIn: ({ className, size = 18 }: IconProps) => <ZoomIn className={className} size={size} />,
  
  // Analytics & Charts
  BarChart: ({ className, size = 18 }: IconProps) => <BarChart className={className} size={size} />,
  Eye: ({ className, size = 18 }: IconProps) => <Eye className={className} size={size} />,
  ShoppingBag: ({ className, size = 18 }: IconProps) => <ShoppingBag className={className} size={size} />,
  
  // Status & Feedback
  AlertCircle: ({ className, size = 18 }: IconProps) => <AlertCircle className={className} size={size} />,
  AlertTriangle: ({ className, size = 18 }: IconProps) => <AlertTriangle className={className} size={size} />,
  CheckCircle: ({ className, size = 18 }: IconProps) => <CheckCircle className={className} size={size} />,
  Lock: ({ className, size = 18 }: IconProps) => <Lock className={className} size={size} />,
  Minus: ({ className, size = 18 }: IconProps) => <Minus className={className} size={size} />,
  X: ({ className, size = 18 }: IconProps) => <X className={className} size={size} />,
  Download: ({ className, size = 18 }: IconProps) => <Download className={className} size={size} />,
  Share: ({ className, size = 18 }: IconProps) => <Share className={className} size={size} />,
  ImageOff: ({ className, size = 18 }: IconProps) => <ImageOff className={className} size={size} />
};