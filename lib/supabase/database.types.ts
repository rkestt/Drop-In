export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "check_ins": {
                  Row: {
                    "accuracy": number | null,"checked_in_at": string | null,"checked_out_at": string | null,"court_id": string,"id": string,"lat": number,"lng": number,"lobby_id": string | null,"status": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accuracy"?: number | null,"checked_in_at"?: string | null,"checked_out_at"?: string | null,"court_id": string,"id"?: string,"lat": number,"lng": number,"lobby_id"?: string | null,"status"?: string | null,"user_id": string
                  }
                  Update: {
                    "accuracy"?: number | null,"checked_in_at"?: string | null,"checked_out_at"?: string | null,"court_id"?: string,"id"?: string,"lat"?: number,"lng"?: number,"lobby_id"?: string | null,"status"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "check_ins_court_id_fkey"
      columns: ["court_id"]
isOneToOne: false
      referencedRelation: "courts"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "check_ins_lobby_id_fkey"
      columns: ["lobby_id"]
isOneToOne: false
      referencedRelation: "lobbies"
      referencedColumns: ["id"]
    }
                  ]
                },"court_reports": {
                  Row: {
                    "category": string,"court_id": string,"created_at": string | null,"description": string | null,"expires_at": string,"id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category": string,"court_id": string,"created_at"?: string | null,"description"?: string | null,"expires_at": string,"id"?: string,"user_id": string
                  }
                  Update: {
                    "category"?: string,"court_id"?: string,"created_at"?: string | null,"description"?: string | null,"expires_at"?: string,"id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "court_reports_court_id_fkey"
      columns: ["court_id"]
isOneToOne: false
      referencedRelation: "courts"
      referencedColumns: ["id"]
    }
                  ]
                },"court_submissions": {
                  Row: {
                    "court_id": string | null,"created_at": string | null,"gps_accuracy": number | null,"id": string,"lat": number,"lng": number,"moderation_note": string | null,"photo_path": string | null,"raw_name": string | null,"status": string,"submitter_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "court_id"?: string | null,"created_at"?: string | null,"gps_accuracy"?: number | null,"id"?: string,"lat": number,"lng": number,"moderation_note"?: string | null,"photo_path"?: string | null,"raw_name"?: string | null,"status"?: string,"submitter_id": string
                  }
                  Update: {
                    "court_id"?: string | null,"created_at"?: string | null,"gps_accuracy"?: number | null,"id"?: string,"lat"?: number,"lng"?: number,"moderation_note"?: string | null,"photo_path"?: string | null,"raw_name"?: string | null,"status"?: string,"submitter_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "court_submissions_court_id_fkey"
      columns: ["court_id"]
isOneToOne: false
      referencedRelation: "courts"
      referencedColumns: ["id"]
    }
                  ]
                },"courts": {
                  Row: {
                    "address": string | null,"created_at": string | null,"duplicate_of": string | null,"hoop_count": number | null,"id": string,"lat": number,"lng": number,"location": unknown,"moderation_status": string,"name": string,"osm_id": string | null,"photo_path": string | null,"source": string,"sport": string | null,"status": string | null,"submitted_by": string | null,"surface_type": string | null,"updated_at": string | null,"venue_type": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"created_at"?: string | null,"duplicate_of"?: string | null,"hoop_count"?: number | null,"id"?: string,"lat": number,"lng": number,"location"?: unknown,"moderation_status"?: string,"name": string,"osm_id"?: string | null,"photo_path"?: string | null,"source"?: string,"sport"?: string | null,"status"?: string | null,"submitted_by"?: string | null,"surface_type"?: string | null,"updated_at"?: string | null,"venue_type"?: string | null
                  }
                  Update: {
                    "address"?: string | null,"created_at"?: string | null,"duplicate_of"?: string | null,"hoop_count"?: number | null,"id"?: string,"lat"?: number,"lng"?: number,"location"?: unknown,"moderation_status"?: string,"name"?: string,"osm_id"?: string | null,"photo_path"?: string | null,"source"?: string,"sport"?: string | null,"status"?: string | null,"submitted_by"?: string | null,"surface_type"?: string | null,"updated_at"?: string | null,"venue_type"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "courts_duplicate_of_fkey"
      columns: ["duplicate_of"]
isOneToOne: false
      referencedRelation: "courts"
      referencedColumns: ["id"]
    }
                  ]
                },"lobbies": {
                  Row: {
                    "court_id": string,"created_at": string | null,"creator_id": string,"id": string,"max_players": number,"start_time": string,"status": string | null,"updated_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "court_id": string,"created_at"?: string | null,"creator_id": string,"id"?: string,"max_players"?: number,"start_time": string,"status"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "court_id"?: string,"created_at"?: string | null,"creator_id"?: string,"id"?: string,"max_players"?: number,"start_time"?: string,"status"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "lobbies_court_id_fkey"
      columns: ["court_id"]
isOneToOne: false
      referencedRelation: "courts"
      referencedColumns: ["id"]
    }
                  ]
                },"lobby_participants": {
                  Row: {
                    "id": string,"joined_at": string | null,"lobby_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"joined_at"?: string | null,"lobby_id": string,"user_id": string
                  }
                  Update: {
                    "id"?: string,"joined_at"?: string | null,"lobby_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lobby_participants_lobby_id_fkey"
      columns: ["lobby_id"]
isOneToOne: false
      referencedRelation: "lobbies"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"banned_until": string | null,"created_at": string | null,"id": string,"is_moderator": boolean,"karma_score": number | null,"nickname": string | null,"updated_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"banned_until"?: string | null,"created_at"?: string | null,"id"?: string,"is_moderator"?: boolean,"karma_score"?: number | null,"nickname"?: string | null,"updated_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "avatar_url"?: string | null,"banned_until"?: string | null,"created_at"?: string | null,"id"?: string,"is_moderator"?: boolean,"karma_score"?: number | null,"nickname"?: string | null,"updated_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_notifications": {
                  Row: {
                    "body": string,"data": Json | null,"id": string,"read_at": string | null,"sent_at": string | null,"title": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"data"?: Json | null,"id"?: string,"read_at"?: string | null,"sent_at"?: string | null,"title": string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"data"?: Json | null,"id"?: string,"read_at"?: string | null,"sent_at"?: string | null,"title"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_subscriptions": {
                  Row: {
                    "created_at": string | null,"id": string,"subscription": NonNullable<Json>,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string | null,"id"?: string,"subscription": NonNullable<Json>,"user_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"id"?: string,"subscription"?: NonNullable<Json>,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"spatial_ref_sys": {
                  Row: {
                    "auth_name": string | null,"auth_srid": number | null,"proj4text": string | null,"srid": number,"srtext": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "auth_name"?: string | null,"auth_srid"?: number | null,"proj4text"?: string | null,"srid": number,"srtext"?: string | null
                  }
                  Update: {
                    "auth_name"?: string | null,"auth_srid"?: number | null,"proj4text"?: string | null,"srid"?: number,"srtext"?: string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "geography_columns": {
                  Row: {
                    "coord_dimension": number | null,"f_geography_column": unknown,"f_table_catalog": unknown,"f_table_name": unknown,"f_table_schema": unknown,"srid": number | null,"type": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"geometry_columns": {
                  Row: {
                    "coord_dimension": number | null,"f_geometry_column": unknown,"f_table_catalog": string | null,"f_table_name": unknown,"f_table_schema": unknown,"srid": number | null,"type": string | null
                  }
                  ComputedFields: never
                  Insert: {
                           "coord_dimension"?: number | null,"f_geometry_column"?: unknown,"f_table_catalog"?: string | null,"f_table_name"?: unknown,"f_table_schema"?: unknown,"srid"?: number | null,"type"?: string | null
                         }
                        Update: {
                           "coord_dimension"?: number | null,"f_geometry_column"?: unknown,"f_table_catalog"?: string | null,"f_table_name"?: unknown,"f_table_schema"?: unknown,"srid"?: number | null,"type"?: string | null
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "_postgis_deprecate":
{ Args: { "newname": string,"oldname": string,"version": string }; Returns: undefined
                           },
"_postgis_index_extent":
{ Args: { "col": string,"tbl": unknown }; Returns: unknown
                           },
"_postgis_pgsql_version":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"_postgis_scripts_pgsql_version":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"_postgis_selectivity":
{ Args: { "att_name": string,"geom": unknown,"mode"?: string,"tbl": unknown }; Returns: number
                           },
"_postgis_stats":
{ Args: { ""?: string,"att_name": string,"tbl": unknown }; Returns: string
                           },
"_st_3dintersects":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"_st_contains":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"_st_containsproperly":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"_st_coveredby":
{ Args: { "geog1": unknown,"geog2": unknown }; Returns: boolean
                           } |
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"_st_covers":
{ Args: { "geog1": unknown,"geog2": unknown }; Returns: boolean
                           } |
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"_st_crosses":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"_st_dwithin":
{ Args: { "geog1": unknown,"geog2": unknown,"tolerance": number,"use_spheroid"?: boolean }; Returns: boolean
                           },
"_st_equals":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"_st_intersects":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"_st_linecrossingdirection":
{ Args: { "line1": unknown,"line2": unknown }; Returns: number
                           },
"_st_longestline":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: unknown
                           },
"_st_maxdistance":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: number
                           },
"_st_orderingequals":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"_st_overlaps":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"_st_sortablehash":
{ Args: { "geom": unknown }; Returns: number
                           },
"_st_touches":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"_st_voronoi":
{ Args: { "clip"?: unknown,"g1": unknown,"return_polygons"?: boolean,"tolerance"?: number }; Returns: unknown
                           },
"_st_within":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"addauth":
{ Args: { "": string }; Returns: boolean
                           },
"addgeometrycolumn":
{ Args: { "catalog_name": string,"column_name": string,"new_dim": number,"new_srid_in": number,"new_type": string,"schema_name": string,"table_name": string,"use_typmod"?: boolean }; Returns: string
                           } |
{ Args: { "column_name": string,"new_dim": number,"new_srid": number,"new_type": string,"schema_name": string,"table_name": string,"use_typmod"?: boolean }; Returns: string
                           } |
{ Args: { "column_name": string,"new_dim": number,"new_srid": number,"new_type": string,"table_name": string,"use_typmod"?: boolean }; Returns: string
                           },
"approve_court":
{ Args: { "p_court_id": string,"p_note"?: string }; Returns: undefined
                           },
"archive_old_reports":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"auto_checkout":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"auto_close_lobbies":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"courts_in_viewport":
{ Args: { "max_lat": number,"max_lng": number,"max_results"?: number,"min_lat": number,"min_lng": number,"p_sport"?: string }; Returns: {
              "address": string,"hoop_count": number,"id": string,"lat": number,"lng": number,"moderation_status": string,"name": string,"photo_path": string,"source": string,"sport": string,"status": string,"surface_type": string,"venue_type": string
            }[]
                           },
"dedup_candidates":
{ Args: { "p_lat": number,"p_lng": number,"p_radius_m"?: number }; Returns: {
              "distance_m": number,"id": string,"lat": number,"lng": number,"moderation_status": string,"name": string,"source": string
            }[]
                           },
"disablelongtransactions":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"dropgeometrycolumn":
{ Args: { "catalog_name": string,"column_name": string,"schema_name": string,"table_name": string }; Returns: string
                           } |
{ Args: { "column_name": string,"schema_name": string,"table_name": string }; Returns: string
                           } |
{ Args: { "column_name": string,"table_name": string }; Returns: string
                           },
"dropgeometrytable":
{ Args: { "catalog_name": string,"schema_name": string,"table_name": string }; Returns: string
                           } |
{ Args: { "schema_name": string,"table_name": string }; Returns: string
                           } |
{ Args: { "table_name": string }; Returns: string
                           },
"enablelongtransactions":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"equals":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"geometry":
{ Args: { "": string }; Returns: unknown
                           },
"geometry_above":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"geometry_below":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"geometry_cmp":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: number
                           },
"geometry_contained_3d":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"geometry_contains":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"geometry_contains_3d":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"geometry_distance_box":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: number
                           },
"geometry_distance_centroid":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: number
                           },
"geometry_eq":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"geometry_ge":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"geometry_gt":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"geometry_le":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"geometry_left":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"geometry_lt":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"geometry_overabove":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"geometry_overbelow":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"geometry_overlaps":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"geometry_overlaps_3d":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"geometry_overleft":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"geometry_overright":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"geometry_right":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"geometry_same":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"geometry_same_3d":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"geometry_within":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"geomfromewkt":
{ Args: { "": string }; Returns: unknown
                           },
"gettransactionid":
{ Args: Record<PropertyKey, never>; Returns: unknown
                           },
"is_moderator":
{ Args: { "p_uid"?: string }; Returns: boolean
                           },
"longtransactionsenabled":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"mark_duplicate":
{ Args: { "p_court_id": string,"p_duplicate_of": string }; Returns: undefined
                           },
"nearby_courts":
{ Args: { "p_lat": number,"p_limit"?: number,"p_lng": number,"p_query"?: string,"p_radius_m"?: number,"p_sport"?: string }; Returns: {
              "address": string,"distance_m": number,"hoop_count": number,"id": string,"lat": number,"lng": number,"name": string,"photo_path": string,"sport": string,"status": string,"surface_type": string,"venue_type": string
            }[]
                           },
"notify_lobby_starting_soon":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"notify_user":
{ Args: { "p_body": string,"p_data"?: Json,"p_title": string,"p_user_id": string }; Returns: undefined
                           },
"open_lobbies":
{ Args: { "p_lat"?: number,"p_limit"?: number,"p_lng"?: number,"p_radius_m"?: number,"p_sport"?: string }; Returns: {
              "court_id": string,"court_name": string,"court_sport": string,"id": string,"max_players": number,"participants_count": number,"start_time": string,"status": string
            }[]
                           },
"populate_geometry_columns":
{ Args: { "tbl_oid": unknown,"use_typmod"?: boolean }; Returns: number
                           } |
{ Args: { "use_typmod"?: boolean }; Returns: string
                           },
"postgis_constraint_dims":
{ Args: { "geomcolumn": string,"geomschema": string,"geomtable": string }; Returns: number
                           },
"postgis_constraint_srid":
{ Args: { "geomcolumn": string,"geomschema": string,"geomtable": string }; Returns: number
                           },
"postgis_constraint_type":
{ Args: { "geomcolumn": string,"geomschema": string,"geomtable": string }; Returns: string
                           },
"postgis_extensions_upgrade":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"postgis_full_version":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"postgis_geos_version":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"postgis_lib_build_date":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"postgis_lib_revision":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"postgis_lib_version":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"postgis_libjson_version":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"postgis_liblwgeom_version":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"postgis_libprotobuf_version":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"postgis_libxml_version":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"postgis_proj_version":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"postgis_scripts_build_date":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"postgis_scripts_installed":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"postgis_scripts_released":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"postgis_svn_version":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"postgis_type_name":
{ Args: { "coord_dimension": number,"geomname": string,"use_new_name"?: boolean }; Returns: string
                           },
"postgis_version":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"postgis_wagyu_version":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"reject_court":
{ Args: { "p_court_id": string,"p_note"?: string }; Returns: undefined
                           },
"remove_expired_bans":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"st_3dclosestpoint":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: unknown
                           },
"st_3ddistance":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: number
                           },
"st_3dintersects":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"st_3dlongestline":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: unknown
                           },
"st_3dmakebox":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: unknown
                           },
"st_3dmaxdistance":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: number
                           },
"st_3dshortestline":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: unknown
                           },
"st_addpoint":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: unknown
                           },
"st_angle":
{ Args: { "line1": unknown,"line2": unknown }; Returns: number
                           } |
{ Args: { "pt1": unknown,"pt2": unknown,"pt3": unknown,"pt4"?: unknown }; Returns: number
                           },
"st_area":
{ Args: { "geog": unknown,"use_spheroid"?: boolean }; Returns: number
                           } |
{ Args: { "": string }; Returns: number
                           },
"st_asencodedpolyline":
{ Args: { "geom": unknown,"nprecision"?: number }; Returns: string
                           },
"st_asewkt":
{ Args: { "": string }; Returns: string
                           },
"st_asgeojson":
{ Args: { "geog": unknown,"maxdecimaldigits"?: number,"options"?: number }; Returns: string
                           } |
{ Args: { "geom": unknown,"maxdecimaldigits"?: number,"options"?: number }; Returns: string
                           } |
{ Args: { "geom_column"?: string,"maxdecimaldigits"?: number,"pretty_bool"?: boolean,"r": Record<string, unknown> }; Returns: string
                           } |
{ Args: { "": string }; Returns: string
                           },
"st_asgml":
{ Args: { "geog": unknown,"id"?: string,"maxdecimaldigits"?: number,"nprefix"?: string,"options"?: number }; Returns: string
                           } |
{ Args: { "geom": unknown,"maxdecimaldigits"?: number,"options"?: number }; Returns: string
                           } |
{ Args: { "": string }; Returns: string
                           } |
{ Args: { "geog": unknown,"id"?: string,"maxdecimaldigits"?: number,"nprefix"?: string,"options"?: number,"version": number }; Returns: string
                           } |
{ Args: { "geom": unknown,"id"?: string,"maxdecimaldigits"?: number,"nprefix"?: string,"options"?: number,"version": number }; Returns: string
                           },
"st_askml":
{ Args: { "geog": unknown,"maxdecimaldigits"?: number,"nprefix"?: string }; Returns: string
                           } |
{ Args: { "geom": unknown,"maxdecimaldigits"?: number,"nprefix"?: string }; Returns: string
                           } |
{ Args: { "": string }; Returns: string
                           },
"st_aslatlontext":
{ Args: { "geom": unknown,"tmpl"?: string }; Returns: string
                           },
"st_asmarc21":
{ Args: { "format"?: string,"geom": unknown }; Returns: string
                           },
"st_asmvtgeom":
{ Args: { "bounds": unknown,"buffer"?: number,"clip_geom"?: boolean,"extent"?: number,"geom": unknown }; Returns: unknown
                           },
"st_assvg":
{ Args: { "geog": unknown,"maxdecimaldigits"?: number,"rel"?: number }; Returns: string
                           } |
{ Args: { "geom": unknown,"maxdecimaldigits"?: number,"rel"?: number }; Returns: string
                           } |
{ Args: { "": string }; Returns: string
                           },
"st_astext":
{ Args: { "": string }; Returns: string
                           },
"st_astwkb":
{ Args: { "geom": unknown,"prec"?: number,"prec_m"?: number,"prec_z"?: number,"with_boxes"?: boolean,"with_sizes"?: boolean }; Returns: string
                           } |
{ Args: { "geom": (unknown)[],"ids": (number)[],"prec"?: number,"prec_m"?: number,"prec_z"?: number,"with_boxes"?: boolean,"with_sizes"?: boolean }; Returns: string
                           },
"st_asx3d":
{ Args: { "geom": unknown,"maxdecimaldigits"?: number,"options"?: number }; Returns: string
                           },
"st_azimuth":
{ Args: { "geog1": unknown,"geog2": unknown }; Returns: number
                           } |
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: number
                           },
"st_boundingdiagonal":
{ Args: { "fits"?: boolean,"geom": unknown }; Returns: unknown
                           },
"st_buffer":
{ Args: { "geom": unknown,"options"?: string,"radius": number }; Returns: unknown
                           } |
{ Args: { "geom": unknown,"quadsegs": number,"radius": number }; Returns: unknown
                           },
"st_centroid":
{ Args: { "": string }; Returns: unknown
                           },
"st_clipbybox2d":
{ Args: { "box": unknown,"geom": unknown }; Returns: unknown
                           },
"st_closestpoint":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: unknown
                           },
"st_collect":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: unknown
                           },
"st_concavehull":
{ Args: { "param_allow_holes"?: boolean,"param_geom": unknown,"param_pctconvex": number }; Returns: unknown
                           },
"st_contains":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"st_containsproperly":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"st_coorddim":
{ Args: { "geometry": unknown }; Returns: number
                           },
"st_coveredby":
{ Args: { "geog1": unknown,"geog2": unknown }; Returns: boolean
                           } |
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"st_covers":
{ Args: { "geog1": unknown,"geog2": unknown }; Returns: boolean
                           } |
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"st_crosses":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"st_curvetoline":
{ Args: { "flags"?: number,"geom": unknown,"tol"?: number,"toltype"?: number }; Returns: unknown
                           },
"st_delaunaytriangles":
{ Args: { "flags"?: number,"g1": unknown,"tolerance"?: number }; Returns: unknown
                           },
"st_difference":
{ Args: { "geom1": unknown,"geom2": unknown,"gridsize"?: number }; Returns: unknown
                           },
"st_disjoint":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"st_distance":
{ Args: { "geog1": unknown,"geog2": unknown,"use_spheroid"?: boolean }; Returns: number
                           } |
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: number
                           },
"st_distancesphere":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: number
                           } |
{ Args: { "geom1": unknown,"geom2": unknown,"radius": number }; Returns: number
                           },
"st_distancespheroid":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: number
                           },
"st_dwithin":
{ Args: { "geog1": unknown,"geog2": unknown,"tolerance": number,"use_spheroid"?: boolean }; Returns: boolean
                           },
"st_equals":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"st_expand":
{ Args: { "box": unknown,"dx": number,"dy": number }; Returns: unknown
                           } |
{ Args: { "box": unknown,"dx": number,"dy": number,"dz"?: number }; Returns: unknown
                           } |
{ Args: { "dm"?: number,"dx": number,"dy": number,"dz"?: number,"geom": unknown }; Returns: unknown
                           },
"st_force3d":
{ Args: { "geom": unknown,"zvalue"?: number }; Returns: unknown
                           },
"st_force3dm":
{ Args: { "geom": unknown,"mvalue"?: number }; Returns: unknown
                           },
"st_force3dz":
{ Args: { "geom": unknown,"zvalue"?: number }; Returns: unknown
                           },
"st_force4d":
{ Args: { "geom": unknown,"mvalue"?: number,"zvalue"?: number }; Returns: unknown
                           },
"st_generatepoints":
{ Args: { "area": unknown,"npoints": number }; Returns: unknown
                           } |
{ Args: { "area": unknown,"npoints": number,"seed": number }; Returns: unknown
                           },
"st_geogfromtext":
{ Args: { "": string }; Returns: unknown
                           },
"st_geographyfromtext":
{ Args: { "": string }; Returns: unknown
                           },
"st_geohash":
{ Args: { "geog": unknown,"maxchars"?: number }; Returns: string
                           } |
{ Args: { "geom": unknown,"maxchars"?: number }; Returns: string
                           },
"st_geomcollfromtext":
{ Args: { "": string }; Returns: unknown
                           },
"st_geometricmedian":
{ Args: { "fail_if_not_converged"?: boolean,"g": unknown,"max_iter"?: number,"tolerance"?: number }; Returns: unknown
                           },
"st_geometryfromtext":
{ Args: { "": string }; Returns: unknown
                           },
"st_geomfromewkt":
{ Args: { "": string }; Returns: unknown
                           },
"st_geomfromgeojson":
{ Args: { "": Json }; Returns: unknown
                           } |
{ Args: { "": Json }; Returns: unknown
                           } |
{ Args: { "": string }; Returns: unknown
                           },
"st_geomfromgml":
{ Args: { "": string }; Returns: unknown
                           },
"st_geomfromkml":
{ Args: { "": string }; Returns: unknown
                           },
"st_geomfrommarc21":
{ Args: { "marc21xml": string }; Returns: unknown
                           },
"st_geomfromtext":
{ Args: { "": string }; Returns: unknown
                           },
"st_gmltosql":
{ Args: { "": string }; Returns: unknown
                           },
"st_hasarc":
{ Args: { "geometry": unknown }; Returns: boolean
                           },
"st_hausdorffdistance":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: number
                           },
"st_hexagon":
{ Args: { "cell_i": number,"cell_j": number,"origin"?: unknown,"size": number }; Returns: unknown
                           },
"st_hexagongrid":
{ Args: { "bounds": unknown,"size": number }; Returns: Record<string, unknown>[]
                           },
"st_interpolatepoint":
{ Args: { "line": unknown,"point": unknown }; Returns: number
                           },
"st_intersection":
{ Args: { "geom1": unknown,"geom2": unknown,"gridsize"?: number }; Returns: unknown
                           },
"st_intersects":
{ Args: { "geog1": unknown,"geog2": unknown }; Returns: boolean
                           } |
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"st_isvaliddetail":
{ Args: { "flags"?: number,"geom": unknown }; Returns: Database["public"]['CompositeTypes']["valid_detail"]
                          SetofOptions: {
        from: "*"
        to: "valid_detail"
        isOneToOne: true
        isSetofReturn: false
      } },
"st_length":
{ Args: { "geog": unknown,"use_spheroid"?: boolean }; Returns: number
                           } |
{ Args: { "": string }; Returns: number
                           },
"st_letters":
{ Args: { "font"?: Json,"letters": string }; Returns: unknown
                           },
"st_linecrossingdirection":
{ Args: { "line1": unknown,"line2": unknown }; Returns: number
                           },
"st_linefromencodedpolyline":
{ Args: { "nprecision"?: number,"txtin": string }; Returns: unknown
                           },
"st_linefromtext":
{ Args: { "": string }; Returns: unknown
                           },
"st_linelocatepoint":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: number
                           },
"st_linetocurve":
{ Args: { "geometry": unknown }; Returns: unknown
                           },
"st_locatealong":
{ Args: { "geometry": unknown,"leftrightoffset"?: number,"measure": number }; Returns: unknown
                           },
"st_locatebetween":
{ Args: { "frommeasure": number,"geometry": unknown,"leftrightoffset"?: number,"tomeasure": number }; Returns: unknown
                           },
"st_locatebetweenelevations":
{ Args: { "fromelevation": number,"geometry": unknown,"toelevation": number }; Returns: unknown
                           },
"st_longestline":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: unknown
                           },
"st_makebox2d":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: unknown
                           },
"st_makeline":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: unknown
                           },
"st_makevalid":
{ Args: { "geom": unknown,"params": string }; Returns: unknown
                           },
"st_maxdistance":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: number
                           },
"st_minimumboundingcircle":
{ Args: { "inputgeom": unknown,"segs_per_quarter"?: number }; Returns: unknown
                           },
"st_mlinefromtext":
{ Args: { "": string }; Returns: unknown
                           },
"st_mpointfromtext":
{ Args: { "": string }; Returns: unknown
                           },
"st_mpolyfromtext":
{ Args: { "": string }; Returns: unknown
                           },
"st_multilinestringfromtext":
{ Args: { "": string }; Returns: unknown
                           },
"st_multipointfromtext":
{ Args: { "": string }; Returns: unknown
                           },
"st_multipolygonfromtext":
{ Args: { "": string }; Returns: unknown
                           },
"st_node":
{ Args: { "g": unknown }; Returns: unknown
                           },
"st_normalize":
{ Args: { "geom": unknown }; Returns: unknown
                           },
"st_offsetcurve":
{ Args: { "distance": number,"line": unknown,"params"?: string }; Returns: unknown
                           },
"st_orderingequals":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"st_overlaps":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"st_perimeter":
{ Args: { "geog": unknown,"use_spheroid"?: boolean }; Returns: number
                           },
"st_pointfromtext":
{ Args: { "": string }; Returns: unknown
                           },
"st_pointm":
{ Args: { "mcoordinate": number,"srid"?: number,"xcoordinate": number,"ycoordinate": number }; Returns: unknown
                           },
"st_pointz":
{ Args: { "srid"?: number,"xcoordinate": number,"ycoordinate": number,"zcoordinate": number }; Returns: unknown
                           },
"st_pointzm":
{ Args: { "mcoordinate": number,"srid"?: number,"xcoordinate": number,"ycoordinate": number,"zcoordinate": number }; Returns: unknown
                           },
"st_polyfromtext":
{ Args: { "": string }; Returns: unknown
                           },
"st_polygonfromtext":
{ Args: { "": string }; Returns: unknown
                           },
"st_project":
{ Args: { "azimuth": number,"distance": number,"geog": unknown }; Returns: unknown
                           },
"st_quantizecoordinates":
{ Args: { "g": unknown,"prec_m"?: number,"prec_x": number,"prec_y"?: number,"prec_z"?: number }; Returns: unknown
                           },
"st_reduceprecision":
{ Args: { "geom": unknown,"gridsize": number }; Returns: unknown
                           },
"st_relate":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: string
                           },
"st_removerepeatedpoints":
{ Args: { "geom": unknown,"tolerance"?: number }; Returns: unknown
                           },
"st_segmentize":
{ Args: { "geog": unknown,"max_segment_length": number }; Returns: unknown
                           },
"st_setsrid":
{ Args: { "geog": unknown,"srid": number }; Returns: unknown
                           } |
{ Args: { "geom": unknown,"srid": number }; Returns: unknown
                           },
"st_sharedpaths":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: unknown
                           },
"st_shortestline":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: unknown
                           },
"st_simplifypolygonhull":
{ Args: { "geom": unknown,"is_outer"?: boolean,"vertex_fraction": number }; Returns: unknown
                           },
"st_split":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: unknown
                           },
"st_square":
{ Args: { "cell_i": number,"cell_j": number,"origin"?: unknown,"size": number }; Returns: unknown
                           },
"st_squaregrid":
{ Args: { "bounds": unknown,"size": number }; Returns: Record<string, unknown>[]
                           },
"st_srid":
{ Args: { "geog": unknown }; Returns: number
                           } |
{ Args: { "geom": unknown }; Returns: number
                           },
"st_subdivide":
{ Args: { "geom": unknown,"gridsize"?: number,"maxvertices"?: number }; Returns: unknown[]
                           },
"st_swapordinates":
{ Args: { "geom": unknown,"ords": unknown }; Returns: unknown
                           },
"st_symdifference":
{ Args: { "geom1": unknown,"geom2": unknown,"gridsize"?: number }; Returns: unknown
                           },
"st_symmetricdifference":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: unknown
                           },
"st_tileenvelope":
{ Args: { "bounds"?: unknown,"margin"?: number,"x": number,"y": number,"zoom": number }; Returns: unknown
                           },
"st_touches":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"st_transform":
{ Args: { "from_proj": string,"geom": unknown,"to_proj": string }; Returns: unknown
                           } |
{ Args: { "from_proj": string,"geom": unknown,"to_srid": number }; Returns: unknown
                           } |
{ Args: { "geom": unknown,"to_proj": string }; Returns: unknown
                           },
"st_triangulatepolygon":
{ Args: { "g1": unknown }; Returns: unknown
                           },
"st_union":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: unknown
                           } |
{ Args: { "geom1": unknown,"geom2": unknown,"gridsize": number }; Returns: unknown
                           },
"st_voronoilines":
{ Args: { "extend_to"?: unknown,"g1": unknown,"tolerance"?: number }; Returns: unknown
                           },
"st_voronoipolygons":
{ Args: { "extend_to"?: unknown,"g1": unknown,"tolerance"?: number }; Returns: unknown
                           },
"st_within":
{ Args: { "geom1": unknown,"geom2": unknown }; Returns: boolean
                           },
"st_wkbtosql":
{ Args: { "wkb": string }; Returns: unknown
                           },
"st_wkttosql":
{ Args: { "": string }; Returns: unknown
                           },
"st_wrapx":
{ Args: { "geom": unknown,"move": number,"wrap": number }; Returns: unknown
                           },
"submit_court":
{ Args: { "p_gps_accuracy"?: number,"p_lat": number,"p_lng": number,"p_name": string,"p_photo_path"?: string,"p_sport"?: string,"p_surface"?: string }; Returns: string
                           },
"unlockrows":
{ Args: { "": string }; Returns: number
                           },
"updategeometrysrid":
{ Args: { "catalogn_name": string,"column_name": string,"new_srid_in": number,"schema_name": string,"table_name": string }; Returns: string
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            "geometry_dump": {
                        "path": (number)[] | null,"geom": unknown
                      },"valid_detail": {
                        "valid": boolean | null,"reason": string | null,"location": unknown
                      }
          }
        },"storage": {
          Tables: {
            "bucket_lifecycle_states": {
                  Row: {
                    "bucket_id": string,"claim_id": string | null,"claim_until": string | null,"continuation": Json | null,"failure_count": number,"generation": string | null,"last_completed_at": string | null,"last_error": Json | null,"last_result": Json | null,"last_started_at": string | null,"last_success_at": string | null,"next_run_at": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_id": string,"claim_id"?: string | null,"claim_until"?: string | null,"continuation"?: Json | null,"failure_count"?: number,"generation"?: string | null,"last_completed_at"?: string | null,"last_error"?: Json | null,"last_result"?: Json | null,"last_started_at"?: string | null,"last_success_at"?: string | null,"next_run_at"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "bucket_id"?: string,"claim_id"?: string | null,"claim_until"?: string | null,"continuation"?: Json | null,"failure_count"?: number,"generation"?: string | null,"last_completed_at"?: string | null,"last_error"?: Json | null,"last_result"?: Json | null,"last_started_at"?: string | null,"last_success_at"?: string | null,"next_run_at"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bucket_lifecycle_states_bucket_id_fkey"
      columns: ["bucket_id"]
isOneToOne: true
      referencedRelation: "buckets"
      referencedColumns: ["id"]
    }
                  ]
                },"buckets": {
                  Row: {
                    "allowed_mime_types": (string)[] | null,"avif_autodetection": boolean | null,"created_at": string | null,"file_size_limit": number | null,"id": string,"lifecycle_configuration": Json | null,"lifecycle_configuration_generation": string | null,"name": string,"owner": string | null,"owner_id": string | null,"public": boolean | null,"type": Database["storage"]['Enums']["buckettype"],"updated_at": string | null,"versioning_status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "allowed_mime_types"?: (string)[] | null,"avif_autodetection"?: boolean | null,"created_at"?: string | null,"file_size_limit"?: number | null,"id": string,"lifecycle_configuration"?: Json | null,"lifecycle_configuration_generation"?: string | null,"name": string,"owner"?: string | null,"owner_id"?: string | null,"public"?: boolean | null,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string | null,"versioning_status"?: string
                  }
                  Update: {
                    "allowed_mime_types"?: (string)[] | null,"avif_autodetection"?: boolean | null,"created_at"?: string | null,"file_size_limit"?: number | null,"id"?: string,"lifecycle_configuration"?: Json | null,"lifecycle_configuration_generation"?: string | null,"name"?: string,"owner"?: string | null,"owner_id"?: string | null,"public"?: boolean | null,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string | null,"versioning_status"?: string
                  }
                  Relationships: [
                    
                  ]
                },"buckets_analytics": {
                  Row: {
                    "created_at": string,"deleted_at": string | null,"format": string,"id": string,"name": string,"type": Database["storage"]['Enums']["buckettype"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deleted_at"?: string | null,"format"?: string,"id"?: string,"name": string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deleted_at"?: string | null,"format"?: string,"id"?: string,"name"?: string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"buckets_vectors": {
                  Row: {
                    "created_at": string,"id": string,"type": Database["storage"]['Enums']["buckettype"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id": string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"type"?: Database["storage"]['Enums']["buckettype"],"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"iceberg_namespaces": {
                  Row: {
                    "bucket_name": string,"catalog_id": string,"created_at": string,"id": string,"metadata": NonNullable<Json>,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_name": string,"catalog_id": string,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "bucket_name"?: string,"catalog_id"?: string,"created_at"?: string,"id"?: string,"metadata"?: NonNullable<Json>,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "iceberg_namespaces_catalog_id_fkey"
      columns: ["catalog_id"]
isOneToOne: false
      referencedRelation: "buckets_analytics"
      referencedColumns: ["id"]
    }
                  ]
                },"iceberg_tables": {
                  Row: {
                    "bucket_name": string,"catalog_id": string,"created_at": string,"id": string,"location": string,"name": string,"namespace_id": string,"remote_table_id": string | null,"shard_id": string | null,"shard_key": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_name": string,"catalog_id": string,"created_at"?: string,"id"?: string,"location": string,"name": string,"namespace_id": string,"remote_table_id"?: string | null,"shard_id"?: string | null,"shard_key"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "bucket_name"?: string,"catalog_id"?: string,"created_at"?: string,"id"?: string,"location"?: string,"name"?: string,"namespace_id"?: string,"remote_table_id"?: string | null,"shard_id"?: string | null,"shard_key"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "iceberg_tables_catalog_id_fkey"
      columns: ["catalog_id"]
isOneToOne: false
      referencedRelation: "buckets_analytics"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "iceberg_tables_namespace_id_fkey"
      columns: ["namespace_id"]
isOneToOne: false
      referencedRelation: "iceberg_namespaces"
      referencedColumns: ["id"]
    }
                  ]
                },"lifecycle_abandoned_artifacts": {
                  Row: {
                    "attempted_at": string,"bucket_id": string,"key": string,"name": string,"version": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempted_at"?: string,"bucket_id": string,"key": string,"name": string,"version"?: string | null
                  }
                  Update: {
                    "attempted_at"?: string,"bucket_id"?: string,"key"?: string,"name"?: string,"version"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"migrations": {
                  Row: {
                    "executed_at": string | null,"hash": string,"id": number,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "executed_at"?: string | null,"hash": string,"id": number,"name": string
                  }
                  Update: {
                    "executed_at"?: string | null,"hash"?: string,"id"?: number,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"objects": {
                  Row: {
                    "archived_at": string | null,"bucket_id": string | null,"created_at": string | null,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"last_accessed_at": string | null,"metadata": Json | null,"name": string | null,"owner": string | null,"owner_id": string | null,"path_tokens": (string)[] | null,"updated_at": string | null,"user_metadata": Json | null,"version": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"bucket_id"?: string | null,"created_at"?: string | null,"id"?: string,"is_delete_marker"?: boolean,"is_versioned"?: boolean,"last_accessed_at"?: string | null,"metadata"?: Json | null,"name"?: string | null,"owner"?: string | null,"owner_id"?: string | null,"path_tokens"?: never,"updated_at"?: string | null,"user_metadata"?: Json | null,"version"?: string | null
                  }
                  Update: {
                    "archived_at"?: string | null,"bucket_id"?: string | null,"created_at"?: string | null,"id"?: string,"is_delete_marker"?: boolean,"is_versioned"?: boolean,"last_accessed_at"?: string | null,"metadata"?: Json | null,"name"?: string | null,"owner"?: string | null,"owner_id"?: string | null,"path_tokens"?: never,"updated_at"?: string | null,"user_metadata"?: Json | null,"version"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "objects_bucketId_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets"
      referencedColumns: ["id"]
    }
                  ]
                },"s3_multipart_uploads": {
                  Row: {
                    "bucket_id": string,"created_at": string,"id": string,"in_progress_size": number,"key": string,"metadata": Json | null,"owner_id": string | null,"upload_signature": string,"user_metadata": Json | null,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_id": string,"created_at"?: string,"id": string,"in_progress_size"?: number,"key": string,"metadata"?: Json | null,"owner_id"?: string | null,"upload_signature": string,"user_metadata"?: Json | null,"version": string
                  }
                  Update: {
                    "bucket_id"?: string,"created_at"?: string,"id"?: string,"in_progress_size"?: number,"key"?: string,"metadata"?: Json | null,"owner_id"?: string | null,"upload_signature"?: string,"user_metadata"?: Json | null,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "s3_multipart_uploads_bucket_id_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets"
      referencedColumns: ["id"]
    }
                  ]
                },"s3_multipart_uploads_parts": {
                  Row: {
                    "bucket_id": string,"created_at": string,"etag": string,"id": string,"key": string,"owner_id": string | null,"part_number": number,"size": number,"upload_id": string,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_id": string,"created_at"?: string,"etag": string,"id"?: string,"key": string,"owner_id"?: string | null,"part_number": number,"size"?: number,"upload_id": string,"version": string
                  }
                  Update: {
                    "bucket_id"?: string,"created_at"?: string,"etag"?: string,"id"?: string,"key"?: string,"owner_id"?: string | null,"part_number"?: number,"size"?: number,"upload_id"?: string,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "s3_multipart_uploads_parts_bucket_id_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "s3_multipart_uploads_parts_upload_id_fkey"
      columns: ["upload_id"]
isOneToOne: false
      referencedRelation: "s3_multipart_uploads"
      referencedColumns: ["id"]
    }
                  ]
                },"vector_indexes": {
                  Row: {
                    "bucket_id": string,"created_at": string,"data_type": string,"dimension": number,"distance_metric": string,"id": string,"metadata_configuration": Json | null,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "bucket_id": string,"created_at"?: string,"data_type": string,"dimension": number,"distance_metric": string,"id"?: string,"metadata_configuration"?: Json | null,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "bucket_id"?: string,"created_at"?: string,"data_type"?: string,"dimension"?: number,"distance_metric"?: string,"id"?: string,"metadata_configuration"?: Json | null,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vector_indexes_bucket_id_fkey"
      columns: ["bucket_id"]
isOneToOne: false
      referencedRelation: "buckets_vectors"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "allow_any_operation":
{ Args: { "expected_operations": (string)[] }; Returns: boolean
                           },
"allow_only_operation":
{ Args: { "expected_operation": string }; Returns: boolean
                           },
"can_insert_object":
{ Args: { "bucketid": string,"metadata": Json,"name": string,"owner": string }; Returns: undefined
                           },
"delete_lifecycle_objects":
{ Args: { "object_ids": (string)[] }; Returns: {
              "id": string,"is_delete_marker": boolean,"metadata": Json
            }[]
                           },
"extension":
{ Args: { "name": string }; Returns: string
                           },
"filename":
{ Args: { "name": string }; Returns: string
                           },
"foldername":
{ Args: { "name": string }; Returns: (string)[]
                           },
"get_common_prefix":
{ Args: { "p_delimiter": string,"p_key": string,"p_prefix": string }; Returns: string
                           },
"get_size_by_bucket":
{ Args: { "delete_markers"?: string,"noncurrent_versions"?: string }; Returns: {
              "bucket_id": string,"size": number
            }[]
                           },
"list_multipart_uploads_with_delimiter":
{ Args: { "bucket_id": string,"delimiter_param": string,"max_keys"?: number,"next_key_token"?: string,"next_upload_token"?: string,"prefix_param": string,"raw_prefix_param"?: string }; Returns: {
              "created_at": string,"id": string,"key": string
            }[]
                           },
"list_objects_with_delimiter":
{ Args: { "_bucket_id": string,"delete_markers"?: string,"delimiter_param": string,"max_keys"?: number,"next_token"?: string,"next_token_archived_at"?: string,"next_token_version"?: string,"noncurrent_versions"?: string,"prefix_param": string,"sort_order"?: string,"start_after"?: string }; Returns: {
              "archived_at": string,"created_at": string,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string,"version": string
            }[]
                           },
"operation":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"reconcile_lifecycle_state":
{ Args: { "policy_changed": boolean,"target_bucket_id": string }; Returns: undefined
                           },
"search":
{ Args: { "bucketname": string,"delete_markers"?: string,"levels"?: number,"limits"?: number,"noncurrent_versions"?: string,"offsets"?: number,"prefix": string,"search"?: string,"sortcolumn"?: string,"sortorder"?: string }; Returns: {
              "archived_at": string,"created_at": string,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string,"version": string
            }[]
                           },
"search_by_timestamp":
{ Args: { "delete_markers"?: string,"noncurrent_versions"?: string,"p_bucket_id": string,"p_level": number,"p_limit": number,"p_prefix": string,"p_sort_column": string,"p_sort_column_after": string,"p_sort_order": string,"p_start_after": string,"p_start_after_version"?: string }; Returns: {
              "archived_at": string,"created_at": string,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"key": string,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string,"version": string
            }[]
                           },
"search_v2":
{ Args: { "bucket_name": string,"delete_markers"?: string,"levels"?: number,"limits"?: number,"noncurrent_versions"?: string,"prefix": string,"sort_column"?: string,"sort_column_after"?: string,"sort_order"?: string,"start_after"?: string,"start_after_archived_at"?: string,"start_after_is_continuation"?: boolean,"start_after_version"?: string }; Returns: {
              "archived_at": string,"created_at": string,"id": string,"is_delete_marker": boolean,"is_versioned": boolean,"key": string,"last_accessed_at": string,"metadata": Json,"name": string,"updated_at": string,"version": string
            }[]
                           }
          }
          Enums: {
            "buckettype": "STANDARD"|"ANALYTICS"|"VECTOR"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        },"storage": {
          Enums: {
            "buckettype": ["STANDARD", "ANALYTICS", "VECTOR"]
          }
        }
} as const
