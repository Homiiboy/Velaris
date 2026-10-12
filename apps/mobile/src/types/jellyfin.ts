export type JellyfinServerInfo = { ServerName?: string; Version?: string; Id?: string };
export type JellyfinUser = { Id: string; Name: string; PrimaryImageTag?: string };
export type JellyfinAuthResponse = { User: JellyfinUser; AccessToken: string; ServerId: string };

export type JellyfinUserData = { Played?: boolean; PlaybackPositionTicks?: number; IsFavorite?: boolean; PlayedPercentage?: number; UnplayedItemCount?: number };
export type JellyfinPerson = { Name: string; Role?: string; Type?: string; Id?: string; PrimaryImageTag?: string };
export type JellyfinMediaStream = {
  Index: number; Type: 'Video' | 'Audio' | 'Subtitle'; Codec?: string; Language?: string; DisplayTitle?: string;
  IsDefault?: boolean; IsExternal?: boolean; SupportsExternalStream?: boolean; DeliveryUrl?: string; Width?: number; Height?: number; VideoRange?: string; VideoRangeType?: string; Channels?: number;
};
export type JellyfinMediaSource = {
  Id: string; Path?: string; Container?: string; SupportsDirectPlay?: boolean; SupportsDirectStream?: boolean; SupportsTranscoding?: boolean;
  TranscodingUrl?: string; DirectStreamUrl?: string; MediaStreams?: JellyfinMediaStream[];
};
export type JellyfinPlaybackInfo = { MediaSources?: JellyfinMediaSource[]; PlaySessionId?: string };
export type JellyfinItem = {
  Id: string; Name: string; EpisodeTitle?: string; OriginalTitle?: string; Type?: string; MediaType?: string; Overview?: string; ProductionYear?: number; PremiereDate?: string; RunTimeTicks?: number;
  CommunityRating?: number; OfficialRating?: string; Genres?: string[]; PrimaryImageTag?: string; ImageTags?: { Primary?: string; [key:string]: string | undefined }; BackdropImageTags?: string[];
  People?: JellyfinPerson[];
  SeriesName?: string; SeriesId?: string; SeasonName?: string; ParentIndexNumber?: number; IndexNumber?: number; Container?: string; MediaSources?: JellyfinMediaSource[]; UserData?: JellyfinUserData;
};
export type JellyfinItemsResponse = { Items: JellyfinItem[]; TotalRecordCount: number };
export type Session = { serverUrl: string; accessToken: string; user: JellyfinUser; serverId: string };
